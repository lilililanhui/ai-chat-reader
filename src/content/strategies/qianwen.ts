import type { Strategy, ChatTurn, SessionInfo, LoadingStatus } from "./types.js";

let chatTurns: ChatTurn[] = [];
let sessionInfo: SessionInfo | null = null;
let loadingStatus: LoadingStatus = { state: "idle", loaded: 0, hasMore: false };
const updateCallbacks: Array<(turns: ChatTurn[]) => void> = [];
const loadingCallbacks: Array<(status: LoadingStatus) => void> = [];
const sessionChangeCallbacks: Array<(sessionId: string) => void> = [];

// 已收集的对话项，按 req_id 去重
const collectedItems = new Map<string, QianwenListItem>();
// 缓存 session list 中的标题映射（sessionId -> title）
const sessionTitleCache = new Map<string, string>();

interface QianwenMessage {
  content?: string;
  mime_type: string;
  status?: string;
  meta_data?: Record<string, unknown>;
}

interface QianwenListItem {
  req_id: string;
  session_id: string;
  request_messages: QianwenMessage[];
  response_messages: QianwenMessage[];
  request_timestamp: number;
  model_name?: string;
}

const SKIP_MIME_TYPES = ["signal/post", "bar/progress", "bar/iframe"];

function parseChatTurnsFromList(items: QianwenListItem[]): ChatTurn[] {
  // 按 request_timestamp 升序排序
  const sorted = [...items].sort(
    (a, b) => a.request_timestamp - b.request_timestamp
  );

  return sorted.map((item, index) => {
    // 提取用户消息
    const userContent =
      item.request_messages
        .filter((m) => m.mime_type === "text/plain" && m.content)
        .map((m) => m.content!)
        .join("\n") || "";

    // 提取 AI 回复：过滤掉非内容消息
    const aiContent =
      item.response_messages
        .filter((m) => !SKIP_MIME_TYPES.includes(m.mime_type) && m.content)
        .map((m) => m.content!)
        .join("\n") || "";

    return {
      index,
      user: { role: "user" as const, content: userContent },
      assistant: aiContent
        ? { role: "assistant" as const, content: aiContent }
        : null,
    };
  });
}

// 旧格式兼容：group_show_list 解析
function parseChatTurnsLegacy(sessionData: {
  group_show_list?: string[];
  session_id?: string;
  title?: string;
  created_at?: number;
  updated_at?: number;
}): { turns: ChatTurn[]; info: SessionInfo | null } {
  const list: string[] = sessionData.group_show_list || [];
  const turns: ChatTurn[] = [];

  for (let i = 0; i < list.length; i += 2) {
    turns.push({
      index: turns.length,
      user: { role: "user", content: list[i] },
      assistant:
        i + 1 < list.length
          ? { role: "assistant", content: list[i + 1] }
          : null,
    });
  }

  const info: SessionInfo | null = sessionData.session_id
    ? {
        sessionId: sessionData.session_id,
        title: sessionData.title || "",
        createdAt: sessionData.created_at || 0,
        updatedAt: sessionData.updated_at || 0,
      }
    : null;

  return { turns, info };
}

function getSessionIdFromUrl(): string {
  const match = location.pathname.match(/\/chat\/([a-f0-9]+)/);
  return match ? match[1] : "";
}

function handleSessionList(list: Array<{ session_id: string; title?: string }>) {
  for (const item of list) {
    if (item.session_id && item.title) {
      sessionTitleCache.set(item.session_id, item.title);
    }
  }

  // 如果当前 sessionInfo 已存在但 title 为空，尝试从缓存补全
  if (sessionInfo && !sessionInfo.title) {
    const cachedTitle = sessionTitleCache.get(sessionInfo.sessionId);
    if (cachedTitle) {
      sessionInfo.title = cachedTitle;
    }
  }
}

function handleApiData(payload: Record<string, unknown>) {
  if (!payload || payload.code !== 0) return;

  const data = payload.data;
  if (!data) return;

  // 新格式：data 是对象且含 list 数组
  if (
    typeof data === "object" &&
    !Array.isArray(data) &&
    Array.isArray((data as { list?: unknown }).list)
  ) {
    const listData = data as { list: QianwenListItem[]; have_next_page?: boolean };

    for (const item of listData.list) {
      collectedItems.set(item.req_id, item);
    }

    // 从收集的所有项中提取 session_id 用于 sessionInfo
    const firstItem = listData.list[0];
    if (firstItem && !sessionInfo) {
      sessionInfo = {
        sessionId: firstItem.session_id,
        title: sessionTitleCache.get(firstItem.session_id) || "",
        createdAt: firstItem.request_timestamp,
        updatedAt: firstItem.request_timestamp,
      };
    }

    // 从所有已收集的项生成 chatTurns
    chatTurns = parseChatTurnsFromList(Array.from(collectedItems.values()));

    for (const cb of updateCallbacks) {
      cb(chatTurns);
    }
    return;
  }

  // 旧格式兼容：data 是数组
  if (Array.isArray(data)) {
    const currentSessionId = getSessionIdFromUrl();
    const sessionData = (
      data as Array<{
        group_show_list?: string[];
        session_id?: string;
        title?: string;
        created_at?: number;
        updated_at?: number;
      }>
    ).find((d) => d.session_id === currentSessionId);
    if (!sessionData) return;

    const result = parseChatTurnsLegacy(sessionData);
    chatTurns = result.turns;
    sessionInfo = result.info;

    for (const cb of updateCallbacks) {
      cb(chatTurns);
    }
  }
}

function injectInterceptor() {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("src/content/injected/qianwen.js");
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);
}

const qianwenStrategy: Strategy = {
  name: "qianwen",
  match: () => location.origin.startsWith("https://www.qianwen.com"),

  getUserMessageElements: () => {
    const nodes = Array.from(
      document.querySelectorAll("[class*='questionItem-']")
    );
    return nodes.filter((node) =>
      Array.from(node.classList).some((cls) => cls.startsWith("questionItem-"))
    ) as HTMLElement[];
  },

  init: () => {
    injectInterceptor();

    window.addEventListener("message", (event) => {
      if (event.source !== window || !event.data || event.data.source !== "qianwen") {
        return;
      }

      // 处理对话数据
      if (event.data.type === "AI_CHAT_READER_DATA") {
        handleApiData(event.data.payload);
      }

      // 处理 session list 数据（获取会话标题）
      if (event.data.type === "AI_CHAT_READER_SESSION_LIST") {
        handleSessionList(event.data.list || []);
      }

      // 处理加载状态
      if (event.data.type === "AI_CHAT_READER_LOADING") {
        loadingStatus = {
          state: event.data.status === "done" ? "done" : "loading",
          loaded: event.data.loaded || 0,
          hasMore: event.data.hasMore || false,
        };
        for (const cb of loadingCallbacks) {
          cb(loadingStatus);
        }
      }

      // 处理会话切换
      if (event.data.type === "AI_CHAT_READER_SESSION_CHANGE") {
        const newSessionId = event.data.sessionId || "";
        // 通知会话切换回调（UI层可以弹出确认框等）
        for (const cb of sessionChangeCallbacks) {
          cb(newSessionId);
        }
        // 清除旧数据
        chatTurns = [];
        sessionInfo = null;
        loadingStatus = { state: "idle", loaded: 0, hasMore: false };
        collectedItems.clear();
        for (const cb of updateCallbacks) {
          cb(chatTurns);
        }
        for (const cb of loadingCallbacks) {
          cb(loadingStatus);
        }
      }
    });
  },

  getChatTurns: () => chatTurns,

  getSessionInfo: () => sessionInfo,

  getLoadingStatus: () => loadingStatus,

  onDataUpdate: (callback) => {
    updateCallbacks.push(callback);
  },

  onLoadingStatusChange: (callback) => {
    loadingCallbacks.push(callback);
  },

  onSessionChange: (callback) => {
    sessionChangeCallbacks.push(callback);
  },

  refresh: () => {
    // 清除本地缓存的数据
    chatTurns = [];
    sessionInfo = null;
    collectedItems.clear();
    loadingStatus = { state: "loading", loaded: 0, hasMore: true };

    for (const cb of updateCallbacks) {
      cb(chatTurns);
    }
    for (const cb of loadingCallbacks) {
      cb(loadingStatus);
    }

    // 通知注入脚本用已保存的真实请求信息重新请求
    window.postMessage(
      { type: "AI_CHAT_READER_REFRESH", source: "qianwen" },
      "*"
    );
  },
};

export default qianwenStrategy;
