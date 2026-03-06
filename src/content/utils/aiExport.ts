import type { ChatTurn, SessionInfo } from "../strategies/types.js";
import type { AppConfig, ExportMetaConfig } from "./storage.js";
import { generateMetaHeader } from "./exportMarkdown.js";
import { callLLM } from "./llmClient.js";

type Section = {
  title: string;
  questionIndices: number[];
};

type ProgressCallback = (message: string) => void;
type StreamCallback = (content: string) => void;

export async function generateAIDocument(
  selectedTurns: ChatTurn[],
  totalCount: number,
  sessionInfo: SessionInfo | null,
  config: AppConfig,
  onProgress: ProgressCallback,
  signal: AbortSignal,
  onStream?: StreamCallback
): Promise<string> {
  // Step 1: meta header (no AI)
  const header = generateMetaHeader(
    sessionInfo,
    selectedTurns.length,
    totalCount,
    config.exportMeta
  );

  // Step 2: generate framework
  onProgress("正在生成文档框架...");
  const sections = await generateFramework(selectedTurns, config, signal);

  // Step 3: polish each section sequentially for streaming display
  const sectionContents: string[] = new Array(sections.length).fill("");
  const total = sections.length;

  if (onStream) {
    // Sequential mode: process one section at a time with streaming output
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const turns = section.questionIndices
        .map((qi) => selectedTurns[qi])
        .filter(Boolean);

      if (turns.length === 0) continue;

      onProgress(`正在润色第 ${i + 1}/${total} 个模块：${section.title}`);

      const onChunk = (chunkContent: string) => {
        // Build preview: completed sections + current streaming section
        const completedParts = sections
          .slice(0, i)
          .map((s, idx) => sectionContents[idx] ? `## ${s.title}\n\n${sectionContents[idx]}` : "")
          .filter(Boolean);
        const currentPart = `## ${section.title}\n\n${chunkContent}`;
        const allParts = [...completedParts, currentPart].join("\n\n---\n\n");
        onStream(header + allParts + "\n");
      };

      const content = await polishSection(section.title, turns, config, signal, onChunk);
      sectionContents[i] = content;
    }
  } else {
    // Parallel mode (no streaming): max 3 concurrent
    const concurrency = 3;
    let completed = 0;

    async function processSection(index: number) {
      const section = sections[index];
      const turns = section.questionIndices
        .map((qi) => selectedTurns[qi])
        .filter(Boolean);

      if (turns.length === 0) {
        sectionContents[index] = "";
        return;
      }

      onProgress(`正在润色第 ${++completed}/${total} 个模块：${section.title}`);
      const content = await polishSection(section.title, turns, config, signal);
      sectionContents[index] = content;
    }

    const queue = sections.map((_, i) => i);
    const workers: Promise<void>[] = [];
    for (let i = 0; i < Math.min(concurrency, queue.length); i++) {
      workers.push(runWorker());
    }

    async function runWorker() {
      while (queue.length > 0) {
        const idx = queue.shift()!;
        await processSection(idx);
      }
    }

    await Promise.all(workers);
  }

  // Step 4: assemble
  onProgress("正在组装文档...");
  const body = sections
    .map((section, i) => {
      const content = sectionContents[i];
      if (!content) return "";
      return `## ${section.title}\n\n${content}`;
    })
    .filter(Boolean)
    .join("\n\n---\n\n");

  return header + body + "\n";
}

async function generateFramework(
  selectedTurns: ChatTurn[],
  config: AppConfig,
  signal: AbortSignal
): Promise<Section[]> {
  const questions = selectedTurns
    .map((t, i) => `${i}. ${t.user.content.replace(/\s+/g, " ").trim()}`)
    .join("\n");

  const systemPrompt = `你是一位专业的技术文档整理助手。以下是一组用户与 AI 的对话中，用户提出的问题列表。
请基于这些问题，组织一个合理的 Markdown 文档框架（仅包含章节标题，不包含内容）。

要求：
1. 相关性强的问题归入同一章节
2. 每个章节标题简洁、概括性强
3. 保持原始问题的覆盖完整性，不要遗漏任何问题
4. 输出纯 JSON 格式（不要 markdown 代码块包裹），结构如下：
{
  "sections": [
    {
      "title": "章节标题",
      "questionIndices": [0, 1, 3]
    }
  ]
}`;

  const response = await callLLM(config.llm, {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `用户问题列表：\n${questions}` },
    ],
    signal,
  });

  try {
    // Try to extract JSON from the response (handle markdown code blocks)
    const jsonStr = response.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(jsonStr);
    if (parsed.sections && Array.isArray(parsed.sections)) {
      return parsed.sections.map((s: { title?: string; questionIndices?: number[] }) => ({
        title: s.title || "未命名章节",
        questionIndices: Array.isArray(s.questionIndices) ? s.questionIndices : [],
      }));
    }
  } catch {
    // Fallback: if AI response can't be parsed, use each question as its own section
  }

  // Fallback: one section per question
  return selectedTurns.map((t, i) => ({
    title: t.user.content.replace(/\s+/g, " ").trim().slice(0, 50) || `对话 ${i + 1}`,
    questionIndices: [i],
  }));
}

async function polishSection(
  sectionTitle: string,
  turns: ChatTurn[],
  config: AppConfig,
  signal: AbortSignal,
  onChunk?: (content: string) => void
): Promise<string> {
  const conversations = turns
    .map((t) => {
      const user = `用户：${t.user.content}`;
      const ai = t.assistant ? `AI：${t.assistant.content}` : "";
      return [user, ai].filter(Boolean).join("\n");
    })
    .join("\n\n---\n\n");

  const systemPrompt = `你是一位专业的技术文档整理助手。请将以下对话内容整理成一段完备、可读的文档内容。

要求：
1. 将对话中的知识点、结论、代码示例等归纳整理，而不是简单罗列问答
2. 保留重要的代码块，并用正确的语言标注
3. 合并重复或冗余的内容
4. 语言流畅、逻辑清晰
5. 输出纯 Markdown 格式（不需要一级标题和二级标题，从三级标题 ### 开始）`;

  const response = await callLLM(config.llm, {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `章节主题：${sectionTitle}\n\n对话内容：\n${conversations}` },
    ],
    signal,
    onChunk,
  });

  return response.trim();
}
