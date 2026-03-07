import type { LLMConfig } from "./storage.js";

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
 * Call LLM API via OpenAI-compatible endpoint.
 * Requires apiEndpoint, apiKey and modelName to be configured.
 */
export async function callLLM(
  config: LLMConfig,
  options: LLMRequestOptions
): Promise<string> {
  if (!config.apiEndpoint || !config.apiKey || !config.modelName) {
    throw new Error("请先在设置中配置 API 端点、API Key 和模型名称。");
  }

  return callOpenAICompatible(config, options);
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
        model: config.modelName,
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
      model: config.modelName,
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
