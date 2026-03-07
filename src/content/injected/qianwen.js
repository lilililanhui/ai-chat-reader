const TARGET_URL = "chat2-api.qianwen.com/api/v1/session/msg/list";
const SESSION_LIST_URL = "chat2-api.qianwen.com/api/v2/session/page/list";
const originalFetch = window.fetch;

// 当前会话 ID
let currentSessionId = "";
// 记录是否已经完成全量加载
let fullLoadDone = false;
// 记录已经通过主动加载发送过的 pos 值，避免重复
const loadedPositions = new Set();
// 保存最近一次拦截到的真实请求信息（含完整 headers），刷新时复用
let savedRequestInfo = null;
// 记录是否已经主动获取过 session title
let sessionTitleFetched = false;


/**
 * 发送数据到 content script
 */
function postData(payload) {
  window.postMessage(
    { type: "AI_CHAT_READER_DATA", source: "qianwen", payload },
    "*"
  );
}

/**
 * 发送加载状态到 content script
 */
function postLoadingStatus(status, loaded, hasMore) {
  window.postMessage(
    { type: "AI_CHAT_READER_LOADING", source: "qianwen", status, loaded, hasMore },
    "*"
  );
}

/**
 * 发送 session list 数据到 content script（用于获取会话标题）
 */
function postSessionList(list) {
  window.postMessage(
    { type: "AI_CHAT_READER_SESSION_LIST", source: "qianwen", list },
    "*"
  );
}

/**
 * 发送会话切换通知到 content script
 */
function postSessionChange(sessionId) {
  window.postMessage(
    { type: "AI_CHAT_READER_SESSION_CHANGE", source: "qianwen", sessionId },
    "*"
  );
}

/**
 * 从 URL 中提取 session_id
 */
function extractSessionIdFromUrl() {
  const match = location.pathname.match(/\/chat\/([a-f0-9]+)/);
  return match ? match[1] : "";
}

/**
 * 从 fetch 参数中提取 headers 为纯对象
 */
function extractHeaders(init) {
  const result = {};
  if (!init || !init.headers) return result;

  if (init.headers instanceof Headers) {
    init.headers.forEach(function (value, key) {
      result[key] = value;
    });
  } else if (Array.isArray(init.headers)) {
    for (const [key, value] of init.headers) {
      result[key] = value;
    }
  } else {
    Object.assign(result, init.headers);
  }
  return result;
}

/**
 * 重置加载状态
 */
function resetState() {
  fullLoadDone = false;
  loadedPositions.clear();
  sessionTitleFetched = false;
}

/**
 * 主动请求 session list 接口获取会话标题
 * 从已拦截到的对话请求中提取认证信息（URL 参数），构造 session list 请求
 */
async function fetchSessionTitle() {
  if (sessionTitleFetched || !savedRequestInfo) return;
  sessionTitleFetched = true;

  try {
    // 从对话请求的 URL 参数中提取公共参数（认证信息）
    var msgParams = savedRequestInfo.params;
    var sessionListUrl = "https://chat2-api.qianwen.com/api/v2/session/page/list";

    // 构造查询参数：复用对话请求中的公共参数
    var queryParams = new URLSearchParams();
    var commonKeys = ["biz_id", "chat_client", "device", "fr", "pr", "ut", "la", "tz"];
    for (var i = 0; i < commonKeys.length; i++) {
      var key = commonKeys[i];
      var val = msgParams.get(key);
      if (val) queryParams.set(key, val);
    }

    var fetchUrl = sessionListUrl + "?" + queryParams.toString();

    // 只使用必要的 headers，避免从 savedRequestInfo.headers 继承导致 content-type 重复
    var reqHeaders = {
      "accept": "application/json",
      "content-type": "application/json"
    };
    // 复用认证相关的 headers
    var authKeys = ["x-deviceid", "x-platform", "x-xsrf-token"];
    for (var j = 0; j < authKeys.length; j++) {
      var ak = authKeys[j];
      if (savedRequestInfo.headers[ak]) {
        reqHeaders[ak] = savedRequestInfo.headers[ak];
      }
    }

    var response = await originalFetch(fetchUrl, {
      method: "POST",
      headers: reqHeaders,
      credentials: "include",
      body: JSON.stringify({ limit: 50, next_token: "", sort_field: "modifiedTime", need_filter_tag: true })
    });

    if (!response.ok) return;

    var data = await response.json();
    if (data && data.code === 0 && data.data && Array.isArray(data.data.list)) {
      postSessionList(data.data.list);
    }
  } catch (e) {
    // ignore errors
  }
}

/**
 * 用已保存的真实请求信息重新请求首页数据
 */
async function refetchWithSavedInfo() {
  if (!savedRequestInfo) {
    // 没有拦截到过请求，无法刷新，通知用户
    postLoadingStatus("done", 0, false);
    return;
  }

  postLoadingStatus("loading", 0, true);

  const { baseUrl, params, headers } = savedRequestInfo;

  // 移除旧的 pos 参数，从第一页开始重新加载
  const freshParams = new URLSearchParams(params);
  freshParams.delete("pos");

  // 更新 session_id 如果会话已切换
  const currentSid = extractSessionIdFromUrl();
  if (currentSid) {
    freshParams.set("session_id", currentSid);
  }

  const fetchUrl = baseUrl + "?" + freshParams.toString();

  try {
    const response = await originalFetch(fetchUrl, {
      method: "GET",
      headers: headers,
      credentials: "include",
    });

    if (!response.ok) {
      console.warn("[AI Chat Reader] Refresh fetch failed:", response.status);
      postLoadingStatus("done", 0, false);
      return;
    }

    const data = await response.json();
    postData(data);

    // 刷新后也重新获取 session title
    fetchSessionTitle();

    if (data && data.code === 0 && data.data && data.data.list) {
      const pageData = data.data;
      if (pageData.have_next_page === true) {
        loadAllPages(baseUrl, freshParams, headers, pageData);
      } else {
        postLoadingStatus("done", pageData.list.length, false);
      }
    } else {
      postLoadingStatus("done", 0, false);
    }
  } catch (err) {
    console.warn("[AI Chat Reader] Refresh fetch error:", err);
    postLoadingStatus("done", 0, false);
  }
}

/**
 * 主动加载全部分页数据
 */
async function loadAllPages(baseUrl, baseParams, headers, firstPageData) {
  if (fullLoadDone) return;
  fullLoadDone = true;

  let hasMore = firstPageData.have_next_page === true;
  let totalLoaded = firstPageData.list.length;

  if (!hasMore) {
    postLoadingStatus("done", totalLoaded, false);
    return;
  }

  let nextPos = getEarliestTimestamp(firstPageData.list);
  postLoadingStatus("loading", totalLoaded, true);

  while (hasMore && nextPos) {
    const posKey = String(nextPos);
    if (loadedPositions.has(posKey)) break;
    loadedPositions.add(posKey);

    try {
      const nextParams = new URLSearchParams(baseParams);
      nextParams.set("pos", String(nextPos));

      const fetchUrl = baseUrl + "?" + nextParams.toString();
      const response = await originalFetch(fetchUrl, {
        method: "GET",
        headers: headers,
        credentials: "include",
      });

      if (!response.ok) {
        console.warn("[AI Chat Reader] Failed to load page:", response.status);
        break;
      }

      const data = await response.json();
      postData(data);

      if (data && data.code === 0 && data.data && data.data.list) {
        const pageList = data.data.list;
        totalLoaded += pageList.length;
        hasMore = data.data.have_next_page === true;

        if (hasMore && pageList.length > 0) {
          nextPos = getEarliestTimestamp(pageList);
        } else {
          hasMore = false;
        }

        postLoadingStatus(hasMore ? "loading" : "done", totalLoaded, hasMore);
      } else {
        break;
      }

      await new Promise(function (resolve) { setTimeout(resolve, 200); });
    } catch (err) {
      console.warn("[AI Chat Reader] Error loading page:", err);
      break;
    }
  }

  postLoadingStatus("done", totalLoaded, false);
}

/**
 * 获取列表中最早的 timestamp
 */
function getEarliestTimestamp(list) {
  if (list.length === 0) return null;
  return Math.min.apply(null, list.map(function (item) { return item.request_timestamp; }));
}

/**
 * 检测并处理会话切换
 */
function checkSessionChange() {
  const newSessionId = extractSessionIdFromUrl();
  if (newSessionId && newSessionId !== currentSessionId) {
    currentSessionId = newSessionId;
    resetState();
    postSessionChange(newSessionId);
  }
}

// ======== 拦截 fetch 请求 ========
window.fetch = async function () {
  const args = arguments;
  const url =
    typeof args[0] === "string" ? args[0] : args[0].url;

  const response = await originalFetch.apply(this, args);

  if (url.includes(TARGET_URL)) {
    const cloned = response.clone();
    try {
      const data = await cloned.json();

      // 保存真实请求信息（含完整 headers），供后续刷新/分页使用
      try {
        const urlObj = new URL(url);
        const init = args[1];
        savedRequestInfo = {
          baseUrl: urlObj.origin + urlObj.pathname,
          params: new URLSearchParams(urlObj.search),
          headers: extractHeaders(init),
        };
      } catch (e) {
        // URL parse error, ignore
      }

      // 将拦截到的数据发送给 content script
      postData(data);

      // 主动获取 session title（首次拦截到对话数据后触发）
      fetchSessionTitle();

      // 如果还有下一页，主动加载全部数据
      if (
        data &&
        data.code === 0 &&
        data.data &&
        data.data.list &&
        data.data.have_next_page === true &&
        !fullLoadDone &&
        savedRequestInfo
      ) {
        loadAllPages(
          savedRequestInfo.baseUrl,
          savedRequestInfo.params,
          savedRequestInfo.headers,
          data.data
        );
      }
    } catch (e) {
      // ignore parse errors
    }
  }

  // 拦截 session list 接口，获取会话标题
  if (url.includes(SESSION_LIST_URL)) {
    const cloned = response.clone();
    try {
      const data = await cloned.json();
      if (data && data.code === 0 && data.data && Array.isArray(data.data.list)) {
        postSessionList(data.data.list);
      }
    } catch (e) {
      // ignore parse errors
    }
  }

  return response;
};

// ======== 监听来自 content script 的消息 ========
window.addEventListener("message", function (event) {
  if (event.source !== window || !event.data || event.data.source !== "qianwen") return;

  // 手动刷新：重置状态并用已保存的真实请求信息重新加载
  if (event.data.type === "AI_CHAT_READER_REFRESH") {
    resetState();
    refetchWithSavedInfo();
  }
});

// ======== 监听 URL 变化（SPA 会话切换检测）========
const originalPushState = history.pushState.bind(history);
const originalReplaceState = history.replaceState.bind(history);

history.pushState = function () {
  originalPushState.apply(history, arguments);
  checkSessionChange();
};

history.replaceState = function () {
  originalReplaceState.apply(history, arguments);
  checkSessionChange();
};

window.addEventListener("popstate", function () {
  checkSessionChange();
});

// 初始化：记录当前会话 ID
currentSessionId = extractSessionIdFromUrl();
