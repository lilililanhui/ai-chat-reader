import type { LLMConfig } from "./storage.js";
import { isOnQianwen } from "./storage.js";

export type LLMMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LLMRequestOptions = {
  messages: LLMMessage[];
  signal?: AbortSignal;
  onChunk?: (content: string) => void;
};

/**
 * Call LLM API and return the full response text.
 * Supports: 1) Qianwen page token (via injected script), 2) OpenAI-compatible API.
 * If onChunk is provided, it will be called with accumulating content during streaming.
 */
export async function callLLM(
  config: LLMConfig,
  options: LLMRequestOptions
): Promise<string> {
  if (isOnQianwen()) {
    return callViaQianwenPage(options);
  }

  if (config.apiEndpoint && config.apiKey) {
    return callOpenAICompatible(config, options);
  }

  throw new Error("没有可用的 AI 服务。请配置 API Key 或在千问页面使用。");
}

// ===== OpenAI Compatible API =====
async function callOpenAICompatible(
  config: LLMConfig,
  options: LLMRequestOptions
): Promise<string> {
  const endpoint = config.apiEndpoint.replace(/\/+$/, "");
  const url = `${endpoint}/chat/completions`;

  // If onChunk is provided, use streaming mode
  if (options.onChunk) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.modelName || "qwen-plus",
        messages: options.messages,
        stream: true,
      }),
      signal: options.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`API 请求失败 (${response.status}): ${text.slice(0, 200)}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let fullContent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullContent += delta;
            options.onChunk(fullContent);
          }
        } catch {
          // skip
        }
      }
    }

    if (!fullContent) throw new Error("API 返回内容为空");
    return fullContent;
  }

  // Non-streaming mode
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.modelName || "qwen-plus",
      messages: options.messages,
      stream: false,
    }),
    signal: options.signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`API 请求失败 (${response.status}): ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("API 返回数据格式异常");
  }
  return content;
}

// ===== Qianwen Page Token (via postMessage to injected script) =====
let requestIdCounter = 0;

function callViaQianwenPage(options: LLMRequestOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const requestId = `acr_llm_${++requestIdCounter}_${Date.now()}`;

    const onAbort = () => {
      window.removeEventListener("message", handler);
      reject(new Error("请求已取消"));
    };

    if (options.signal) {
      if (options.signal.aborted) {
        reject(new Error("请求已取消"));
        return;
      }
      options.signal.addEventListener("abort", onAbort, { once: true });
    }

    const timeoutId = setTimeout(() => {
      window.removeEventListener("message", handler);
      options.signal?.removeEventListener("abort", onAbort);
      reject(new Error("AI 请求超时（60s）"));
    }, 60000);

    function handler(event: MessageEvent) {
      if (
        event.source !== window ||
        !event.data ||
        event.data.source !== "qianwen"
      ) {
        return;
      }

      // Handle streaming chunks
      if (
        event.data.type === "AI_CHAT_READER_LLM_CHUNK" &&
        event.data.requestId === requestId
      ) {
        if (options.onChunk && event.data.content) {
          options.onChunk(event.data.content);
        }
        return;
      }

      // Handle final response
      if (
        event.data.type === "AI_CHAT_READER_LLM_RESPONSE" &&
        event.data.requestId === requestId
      ) {
        window.removeEventListener("message", handler);
        clearTimeout(timeoutId);
        options.signal?.removeEventListener("abort", onAbort);

        if (event.data.error) {
          reject(new Error(event.data.error));
        } else {
          resolve(event.data.content || "");
        }
      }
    }

    window.addEventListener("message", handler);

    window.postMessage(
      {
        type: "AI_CHAT_READER_LLM_REQUEST",
        source: "qianwen",
        requestId,
        messages: options.messages,
      },
      "*"
    );
  });
}
