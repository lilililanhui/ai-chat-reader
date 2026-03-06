const TARGET_URL = "chat2-api.qianwen.com/api/v1/session/msg/list";
const CHAT_API_URL = "chat2.qianwen.com/api/v2/chat";

const originalFetch = window.fetch;

// 当前会话 ID
let currentSessionId = "";
// 记录是否已经完成全量加载
let fullLoadDone = false;
// 记录已经通过主动加载发送过的 pos 值，避免重复
const loadedPositions = new Set();
// 保存最近一次拦截到的真实请求信息（含完整 headers），刷新时复用
let savedRequestInfo = null;
// 保存最近一次拦截到的千问 chat API 请求的基础信息（不含安全签名 headers）
let savedChatRequestInfo = null;
// 保存千问前端最新的 fetch 函数引用（经过安全 SDK 包装后的版本，会自动注入签名 headers）
let wrappedFetch = null;

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
// 保存当前的 window.fetch（可能已经被千问安全 SDK 包装过，包含签名注入逻辑）
// 我们的 LLM 请求将通过这个引用发出，从而自动获得安全签名
wrappedFetch = window.fetch;

window.fetch = async function () {
  const args = arguments;
  const url =
    typeof args[0] === "string" ? args[0] : args[0].url;

  // 拦截千问 chat API 请求，捕获业务信息（不含安全签名 headers，签名由 SDK 自动注入）
  if (url.includes(CHAT_API_URL)) {
    try {
      var init = args[1];
      var bodyStr = "";
      if (init && init.body) {
        bodyStr = typeof init.body === "string" ? init.body : JSON.stringify(init.body);
      }
      var bodyObj = {};
      try { bodyObj = JSON.parse(bodyStr); } catch (e) { /* ignore */ }

      // 从 URL 中提取 ut 和 x-deviceid
      var chatUrlObj = new URL(url);
      var ut = chatUrlObj.searchParams.get("ut") || "";

      // 提取少量不涉及安全签名的业务 headers
      var capturedHeaders = extractHeaders(init);

      savedChatRequestInfo = {
        sessionId: bodyObj.session_id || extractSessionIdFromUrl(),
        model: bodyObj.model || "Qwen3-Max",
        ut: ut,
        xDeviceId: capturedHeaders["x-deviceid"] || "",
        xPlatform: capturedHeaders["x-platform"] || "pc_tongyi",
        xXsrfToken: capturedHeaders["x-xsrf-token"] || "",
      };
    } catch (e) {
      // ignore capture errors
    }
  }

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

  return response;
};

/**
 * 生成唯一 ID（模拟千问前端的 req_id / chat_id 格式）
 */
function generateUUID() {
  return "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx".replace(/x/g, function () {
    return ((Math.random() * 16) | 0).toString(16);
  });
}

/**
 * 解析 SSE 流式响应，提取最终完整的 AI 回复内容
 * @param {Response} response - fetch 响应
 * @param {string} requestId - 请求 ID，用于发送流式 chunk
 */
async function parseSSEResponse(response, requestId) {
  var reader = response.body.getReader();
  var decoder = new TextDecoder("utf-8");
  var buffer = "";
  var lastContent = "";

  while (true) {
    var result = await reader.read();
    if (result.done) break;

    buffer += decoder.decode(result.value, { stream: true });

    // 按双换行分割 SSE 事件
    var parts = buffer.split("\n\n");
    // 最后一段可能不完整，保留
    buffer = parts.pop() || "";

    for (var i = 0; i < parts.length; i++) {
      var eventBlock = parts[i].trim();
      if (!eventBlock) continue;

      // 提取 data: 行
      var lines = eventBlock.split("\n");
      var dataLine = "";
      for (var j = 0; j < lines.length; j++) {
        if (lines[j].indexOf("data:") === 0) {
          dataLine = lines[j].substring(5);
          break;
        }
      }

      if (!dataLine) continue;

      try {
        var parsed = JSON.parse(dataLine);
        // 千问 SSE 响应结构: data.messages[1].content (index 1 是 AI 回复，index 0 是 signal/post)
        if (parsed.data && parsed.data.messages) {
          var msgs = parsed.data.messages;
          for (var k = 0; k < msgs.length; k++) {
            if (msgs[k].mime_type !== "signal/post" && msgs[k].content) {
              lastContent = msgs[k].content;
            }
          }
        }
      } catch (e) {
        // JSON 解析失败，跳过
      }

      // 每次解析到新内容后，发送流式 chunk 到 content script
      if (lastContent && requestId) {
        postLLMChunk(requestId, lastContent);
      }
    }
  }

  return lastContent;
}

/**
 * 通过千问页面 Cookie 调用千问 AI 对话 SSE 接口
 * 使用 wrappedFetch（千问安全 SDK 包装后的 fetch）发请求，签名 headers 会自动注入
 */
async function handleLLMRequest(requestId, messages) {
  if (!savedChatRequestInfo) {
    postLLMResponse(requestId, null, "尚未捕获到千问 Chat 请求的认证信息。请先在千问页面发送一条消息后再试。");
    return;
  }

  var fetchFn = wrappedFetch || originalFetch;

  try {
    var chatId = generateUUID();
    var timestamp = Date.now();
    var nonce = Math.random().toString(36).substring(2, 15);
    var sessionId = extractSessionIdFromUrl() || savedChatRequestInfo.sessionId || "";

    // 构造千问 chat API 请求体
    var userContent = "";
    for (var i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        userContent = messages[i].content;
        break;
      }
    }

    var systemContent = "";
    for (var i = 0; i < messages.length; i++) {
      if (messages[i].role === "system") {
        systemContent = messages[i].content;
        break;
      }
    }

    if (systemContent && userContent) {
      userContent = systemContent + "\n\n" + userContent;
    }

    var reqBody = {
      deep_search: "0",
      req_id: chatId,
      model: savedChatRequestInfo.model || "Qwen3-Max",
      scene: "chat",
      session_id: sessionId,
      sub_scene: "chat",
      temporary: true,
      messages: [
        {
          content: userContent,
          mime_type: "text/plain",
          meta_data: { ori_query: userContent },
        },
      ],
      from: "default",
      parent_req_id: "0",
      scene_param: "first_turn",
      chat_client: "h5",
      client_tm: String(timestamp),
      protocol_version: "v2",
      biz_id: "ai_qwen",
    };

    // 只传业务 headers，安全签名由 wrappedFetch 中的千问 SDK 拦截器自动注入
    var headers = {
      "accept": "application/json, text/event-stream, text/plain, */*",
      "content-type": "application/json",
      "x-chat-id": chatId,
      "x-platform": savedChatRequestInfo.xPlatform || "pc_tongyi",
    };
    if (savedChatRequestInfo.xDeviceId) {
      headers["x-deviceid"] = savedChatRequestInfo.xDeviceId;
    }
    if (savedChatRequestInfo.xXsrfToken) {
      headers["x-xsrf-token"] = savedChatRequestInfo.xXsrfToken;
    }

    var urlParams = new URLSearchParams({
      biz_id: "ai_qwen",
      chat_client: "h5",
      device: "pc",
      fr: "pc",
      pr: "qwen",
      ut: savedChatRequestInfo.ut || "",
      nonce: nonce,
      timestamp: String(timestamp),
    });

    var fetchUrl = "https://chat2.qianwen.com/api/v2/chat?" + urlParams.toString();

    var response = await fetchFn(fetchUrl, {
      method: "POST",
      headers: headers,
      credentials: "include",
      body: JSON.stringify(reqBody),
    });

    if (!response.ok) {
      var errText = "";
      try { errText = await response.text(); } catch (e) { /* ignore */ }
      postLLMResponse(requestId, null, "千问 API 请求失败 (" + response.status + "): " + errText.slice(0, 200));
      return;
    }

    // 解析 SSE 流式响应（同时发送流式 chunk）
    var content = await parseSSEResponse(response, requestId);

    if (content) {
      postLLMResponse(requestId, content, null);
    } else {
      postLLMResponse(requestId, null, "千问 API 返回内容为空，请重试。");
    }
  } catch (err) {
    postLLMResponse(requestId, null, "千问 AI 请求出错: " + (err.message || String(err)));
  }
}

function postLLMChunk(requestId, content) {
  window.postMessage(
    {
      type: "AI_CHAT_READER_LLM_CHUNK",
      source: "qianwen",
      requestId: requestId,
      content: content,
    },
    "*"
  );
}

function postLLMResponse(requestId, content, error) {
  window.postMessage(
    {
      type: "AI_CHAT_READER_LLM_RESPONSE",
      source: "qianwen",
      requestId: requestId,
      content: content,
      error: error,
    },
    "*"
  );
}

// ======== 监听来自 content script 的消息 ========
window.addEventListener("message", function (event) {
  if (event.source !== window || !event.data || event.data.source !== "qianwen") return;

  // 手动刷新：重置状态并用已保存的真实请求信息重新加载
  if (event.data.type === "AI_CHAT_READER_REFRESH") {
    resetState();
    refetchWithSavedInfo();
  }

  // LLM 请求：通过千问页面 Token 调用 AI 接口
  if (event.data.type === "AI_CHAT_READER_LLM_REQUEST" && event.data.requestId) {
    handleLLMRequest(event.data.requestId, event.data.messages);
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
