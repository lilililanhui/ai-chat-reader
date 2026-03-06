import type { ChatTurn, SessionInfo } from "../strategies/types.js";
import type { ExportMetaConfig } from "./storage.js";

export function generateMarkdown(
  selectedTurns: ChatTurn[],
  totalCount: number,
  sessionInfo: SessionInfo | null,
  metaConfig?: ExportMetaConfig
): string {
  const title = sessionInfo?.title || "AI 对话记录";
  const sessionId = sessionInfo?.sessionId || "";
  const sourceUrl = sessionId
    ? `https://www.qianwen.com/chat/${sessionId}`
    : location.href;
  const now = new Date();
  const exportTime = formatDate(now);

  const meta = metaConfig ?? { showSource: true, showExportTime: true, showTurnCount: true };

  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push("");

  const metaLines: string[] = [];
  if (meta.showSource) {
    metaLines.push(`> 来源：千问 (${sourceUrl})`);
  }
  if (meta.showExportTime) {
    metaLines.push(`> 导出时间：${exportTime}`);
  }
  if (meta.showTurnCount) {
    metaLines.push(
      `> 对话轮次：${selectedTurns.length} / ${totalCount}（已选/总计）`
    );
  }

  if (metaLines.length > 0) {
    lines.push(...metaLines);
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  for (let i = 0; i < selectedTurns.length; i++) {
    const turn = selectedTurns[i];
    const question = turn.user.content.replace(/\s+/g, " ").trim();
    lines.push(`## ${question || `对话 ${i + 1}`}`);
    lines.push("");

    if (turn.assistant) {
      lines.push(turn.assistant.content);
      lines.push("");
    }

    if (i < selectedTurns.length - 1) {
      lines.push("---");
      lines.push("");
    }
  }

  return lines.join("\n");
}

export function generateMetaHeader(
  sessionInfo: SessionInfo | null,
  selectedCount: number,
  totalCount: number,
  metaConfig?: ExportMetaConfig
): string {
  const title = sessionInfo?.title || "AI 对话记录";
  const sessionId = sessionInfo?.sessionId || "";
  const sourceUrl = sessionId
    ? `https://www.qianwen.com/chat/${sessionId}`
    : location.href;
  const exportTime = formatDate(new Date());

  const meta = metaConfig ?? { showSource: true, showExportTime: true, showTurnCount: true };

  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push("");

  const metaLines: string[] = [];
  if (meta.showSource) {
    metaLines.push(`> 来源：千问 (${sourceUrl})`);
  }
  if (meta.showExportTime) {
    metaLines.push(`> 导出时间：${exportTime}`);
  }
  if (meta.showTurnCount) {
    metaLines.push(
      `> 对话轮次：${selectedCount} / ${totalCount}（已选/总计）`
    );
  }

  if (metaLines.length > 0) {
    lines.push(...metaLines);
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}

export function downloadMarkdown(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 100);
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
}
