import type { ChatTurn, SessionInfo } from "../strategies/types.js";
import { generateMarkdown, downloadMarkdown } from "../utils/exportMarkdown.js";
import { generateAIDocument } from "../utils/aiExport.js";
import { loadConfig, hasLLMConfigured } from "../utils/storage.js";

type ExportModeOptions = {
  shadow: ShadowRoot;
  list: HTMLDivElement;
  panel: HTMLDivElement;
  turns: ChatTurn[];
  sessionInfo: SessionInfo | null;
  onExit: () => void;
};

export function enterExportMode(options: ExportModeOptions) {
  const { shadow, list, panel, turns, sessionInfo, onExit } = options;

  if (turns.length === 0) {
    alert("暂无对话数据可导出");
    return;
  }

  const selected = new Set<number>(turns.map((t) => t.index));
  let previewTab: "rendered" | "source" = "rendered";
  let currentMarkdown = "";
  let abortController: AbortController | null = null;

  // Clean up any residual UI from previous modes
  const oldFooter = shadow.querySelector(".acr-footer");
  if (oldFooter) oldFooter.remove();
  const oldPreview = shadow.querySelector(".acr-preview-wrap");
  if (oldPreview) oldPreview.remove();
  const oldLoading = shadow.querySelector(".acr-ai-loading-wrap");
  if (oldLoading) oldLoading.remove();
  const oldSettings = shadow.querySelector(".acr-settings-wrap");
  if (oldSettings) oldSettings.remove();
  const oldBack = shadow.querySelector(".acr-back-btn");
  if (oldBack) oldBack.remove();

  // Declare all variables before calling renderSelectPhase(),
  // because let/const have TDZ and cannot be accessed before initialization.
  let selectAllCheckbox: HTMLInputElement | null = null;
  const cardCheckboxes: { checkbox: HTMLInputElement; card: HTMLDivElement; index: number }[] = [];

  list.style.display = "";
  list.innerHTML = "";
  renderSelectPhase();

  function cleanup() {
    abortController?.abort();
    const f = shadow.querySelector(".acr-footer");
    if (f) f.remove();
    removeBackBtn();
    onExit();
  }

  function injectBackBtn(onClick: () => void) {
    removeBackBtn();
    const header = panel.querySelector(".acr-header") as HTMLDivElement;
    if (!header) return;
    const btn = document.createElement("button");
    btn.className = "acr-icon-btn acr-back-btn";
    btn.type = "button";
    btn.title = "返回";
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>`;
    btn.addEventListener("click", onClick);
    header.insertBefore(btn, header.firstChild);
  }

  function removeBackBtn() {
    const header = panel.querySelector(".acr-header") as HTMLDivElement;
    if (!header) return;
    const existing = header.querySelector(".acr-back-btn");
    if (existing) existing.remove();
  }

  function renderSelectPhase() {
    list.innerHTML = "";
    removeFooter();
    cardCheckboxes.length = 0;

    // Header bar with select-all checkbox
    const headerBar = document.createElement("div");
    headerBar.className = "acr-select-header";

    selectAllCheckbox = document.createElement("input");
    selectAllCheckbox.type = "checkbox";
    selectAllCheckbox.className = "acr-settings-checkbox";
    selectAllCheckbox.checked = selected.size === turns.length;
    selectAllCheckbox.indeterminate = selected.size > 0 && selected.size < turns.length;

    const selectLabel = document.createElement("span");
    selectLabel.className = "acr-select-header-label";
    selectLabel.textContent = `已选 ${selected.size} / ${turns.length}`;

    selectAllCheckbox.addEventListener("change", () => {
      if (selectAllCheckbox!.checked) {
        for (const t of turns) selected.add(t.index);
      } else {
        selected.clear();
      }
      syncAllCheckboxes();
      updateSelectFooter();
    });

    headerBar.appendChild(selectAllCheckbox);
    headerBar.appendChild(selectLabel);
    list.appendChild(headerBar);

    for (const turn of turns) {
      const card = document.createElement("div");
      card.className = `acr-export-card${selected.has(turn.index) ? " selected" : ""}`;

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = selected.has(turn.index);

      const content = document.createElement("div");
      content.className = "acr-card-content";

      const userLine = document.createElement("div");
      userLine.className = "acr-card-user";
      userLine.textContent = truncate(turn.user.content, 60);
      content.appendChild(userLine);

      if (turn.assistant) {
        const aiLine = document.createElement("div");
        aiLine.className = "acr-card-ai";
        aiLine.textContent = truncate(stripMarkdown(turn.assistant.content), 120);
        content.appendChild(aiLine);
      }

      card.appendChild(checkbox);
      card.appendChild(content);
      cardCheckboxes.push({ checkbox, card, index: turn.index });

      const toggle = () => {
        if (selected.has(turn.index)) selected.delete(turn.index);
        else selected.add(turn.index);
        checkbox.checked = selected.has(turn.index);
        card.className = `acr-export-card${selected.has(turn.index) ? " selected" : ""}`;
        syncSelectAllState();
        updateSelectFooter();
      };
      checkbox.addEventListener("change", toggle);
      card.addEventListener("click", (e) => { if (e.target !== checkbox) toggle(); });
      list.appendChild(card);
    }

    // Ensure list is visible (it may have been hidden by preview/AI phase)
    list.style.display = "";
    createSelectFooter();
  }

  function syncAllCheckboxes() {
    for (const item of cardCheckboxes) {
      item.checkbox.checked = selected.has(item.index);
      item.card.className = `acr-export-card${selected.has(item.index) ? " selected" : ""}`;
    }
    syncSelectAllState();
  }

  function syncSelectAllState() {
    if (!selectAllCheckbox) return;
    selectAllCheckbox.checked = selected.size === turns.length;
    selectAllCheckbox.indeterminate = selected.size > 0 && selected.size < turns.length;
    // Update label
    const label = selectAllCheckbox.parentElement?.querySelector(".acr-select-header-label");
    if (label) label.textContent = `已选 ${selected.size} / ${turns.length}`;
  }

  function createSelectFooter() {
    // Only remove old footer element, don't call full removeFooter()
    // which would also remove preview-wrap and reset list display
    const oldFooter = shadow.querySelector(".acr-footer");
    if (oldFooter) oldFooter.remove();
    injectBackBtn(cleanup);

    const footer = document.createElement("div");
    footer.className = "acr-footer";
    footer.style.justifyContent = "flex-end";

    const directBtn = document.createElement("button");
    directBtn.className = "acr-btn-secondary";
    directBtn.type = "button";
    directBtn.textContent = "直接生成";

    const aiBtn = document.createElement("button");
    aiBtn.className = "acr-btn-primary";
    aiBtn.type = "button";
    aiBtn.textContent = "AI 润色";

    const btnGroup = document.createElement("div");
    btnGroup.className = "acr-btn-group";
    btnGroup.appendChild(directBtn);
    btnGroup.appendChild(aiBtn);
    footer.appendChild(btnGroup);

    panel.appendChild(footer);

    // Check AI availability: all three LLM config fields must be set
    loadConfig().then((config) => {
      if (!hasLLMConfigured(config)) {
        aiBtn.disabled = true;
        aiBtn.title = "请先在设置中配置 API 端点、API Key 和模型名称";
      }
    });

    function update() {
      directBtn.disabled = selected.size === 0;
      aiBtn.disabled = selected.size === 0 || aiBtn.disabled;
    }
    update();

    (footer as any)._update = update;

    directBtn.addEventListener("click", async () => {
      if (selected.size === 0) { alert("请至少选择一条对话"); return; }
      const config = await loadConfig();
      const selectedTurns = turns.filter((t) => selected.has(t.index));
      currentMarkdown = generateMarkdown(selectedTurns, turns.length, sessionInfo, config.exportMeta);
      renderPreviewPhase(false);
    });

    aiBtn.addEventListener("click", async () => {
      if (selected.size === 0) { alert("请至少选择一条对话"); return; }
      renderAIGeneratingPhase();
    });
  }

  function updateSelectFooter() {
    const footer = shadow.querySelector(".acr-footer") as any;
    if (footer && footer._update) footer._update();
  }

  // ==================== AI Generating Phase ====================
  async function renderAIGeneratingPhase() {
    list.innerHTML = "";
    removeFooter();

    abortController = new AbortController();

    // Create streaming preview layout
    const wrap = document.createElement("div");
    wrap.className = "acr-preview-wrap";

    // Toolbar with progress info
    const toolbar = document.createElement("div");
    toolbar.className = "acr-preview-toolbar";

    const progressInfo = document.createElement("div");
    progressInfo.className = "acr-stream-progress";
    progressInfo.innerHTML = `<span class="acr-stream-dot"></span><span class="acr-stream-text">正在准备...</span>`;

    toolbar.appendChild(progressInfo);
    wrap.appendChild(toolbar);

    // Streaming content area
    const contentArea = document.createElement("div");
    contentArea.className = "acr-preview-content rendered";
    contentArea.innerHTML = `<div class="acr-stream-placeholder">
      <div class="acr-ai-spinner"></div>
      <div class="acr-ai-progress">正在生成文档框架...</div>
    </div>`;
    wrap.appendChild(contentArea);

    list.style.display = "none";
    panel.insertBefore(wrap, list);

    // Footer with cancel button
    const footer = document.createElement("div");
    footer.className = "acr-footer";

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "acr-btn-secondary";
    cancelBtn.type = "button";
    cancelBtn.textContent = "取消";
    cancelBtn.addEventListener("click", () => {
      abortController?.abort();
      wrap.remove();
      list.style.display = "";
      renderSelectPhase();
    });

    footer.appendChild(cancelBtn);
    panel.appendChild(footer);

    let hasStreamContent = false;

    try {
      const config = await loadConfig();
      const selectedTurns = turns.filter((t) => selected.has(t.index));

      currentMarkdown = await generateAIDocument(
        selectedTurns,
        turns.length,
        sessionInfo,
        config,
        (msg) => {
          // Update progress text
          const progressTextEl = progressInfo.querySelector(".acr-stream-text");
          if (progressTextEl) progressTextEl.textContent = msg;
          // Also update placeholder if still showing
          const placeholderProgress = contentArea.querySelector(".acr-ai-progress");
          if (placeholderProgress) placeholderProgress.textContent = msg;
        },
        abortController.signal,
        (streamContent) => {
          // First streaming content: remove placeholder
          if (!hasStreamContent) {
            hasStreamContent = true;
            contentArea.innerHTML = "";
          }
          // Render streaming markdown content
          contentArea.innerHTML = markdownToHtml(streamContent);
          // Auto-scroll to bottom
          contentArea.scrollTop = contentArea.scrollHeight;
        }
      );

      wrap.remove();
      footer.remove();
      list.style.display = "";
      renderPreviewPhase(true);
    } catch (err: any) {
      if (err?.message === "请求已取消") return;

      // Show error in content area
      const progressTextEl = progressInfo.querySelector(".acr-stream-text");
      if (progressTextEl) progressTextEl.textContent = "生成失败";

      if (!hasStreamContent) {
        contentArea.innerHTML = "";
      }

      const errorDiv = document.createElement("div");
      errorDiv.className = "acr-ai-error";
      errorDiv.style.padding = "20px";
      errorDiv.style.textAlign = "center";
      errorDiv.textContent = `生成失败：${err?.message || "未知错误"}`;
      contentArea.appendChild(errorDiv);

      // Add retry button
      const retryBtn = document.createElement("button");
      retryBtn.className = "acr-btn-primary";
      retryBtn.type = "button";
      retryBtn.textContent = "重试";
      retryBtn.style.marginTop = "12px";
      retryBtn.addEventListener("click", () => {
        wrap.remove();
        footer.remove();
        list.style.display = "";
        renderAIGeneratingPhase();
      });
      contentArea.appendChild(retryBtn);
    }
  }

  // ==================== Preview Phase ====================
  function renderPreviewPhase(isAIMode: boolean) {
    list.innerHTML = "";
    removeFooter();

    const wrap = document.createElement("div");
    wrap.className = "acr-preview-wrap";

    // Toolbar
    const toolbar = document.createElement("div");
    toolbar.className = "acr-preview-toolbar";

    const tabGroup = document.createElement("div");
    tabGroup.style.cssText = "display:flex;gap:4px;";

    const renderedTab = document.createElement("button");
    renderedTab.className = "acr-tab active";
    renderedTab.type = "button";
    renderedTab.textContent = "预览";

    const sourceTab = document.createElement("button");
    sourceTab.className = "acr-tab";
    sourceTab.type = "button";
    sourceTab.textContent = "源码";

    tabGroup.appendChild(renderedTab);
    tabGroup.appendChild(sourceTab);

    const copyBtn = document.createElement("button");
    copyBtn.className = "acr-copy-btn";
    copyBtn.type = "button";
    copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制`;

    toolbar.appendChild(tabGroup);
    toolbar.appendChild(copyBtn);

    // Content
    const contentArea = document.createElement("div");
    contentArea.className = "acr-preview-content rendered";

    function renderContent() {
      if (previewTab === "rendered") {
        contentArea.className = "acr-preview-content rendered";
        contentArea.innerHTML = markdownToHtml(currentMarkdown);
      } else {
        contentArea.className = "acr-preview-content";
        contentArea.innerHTML = "";
        const pre = document.createElement("pre");
        pre.textContent = currentMarkdown;
        contentArea.appendChild(pre);
      }
    }
    renderContent();

    renderedTab.addEventListener("click", () => {
      previewTab = "rendered";
      renderedTab.className = "acr-tab active";
      sourceTab.className = "acr-tab";
      renderContent();
    });
    sourceTab.addEventListener("click", () => {
      previewTab = "source";
      sourceTab.className = "acr-tab active";
      renderedTab.className = "acr-tab";
      renderContent();
    });

    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(currentMarkdown);
        copyBtn.classList.add("copied");
        const origHTML = copyBtn.innerHTML;
        copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>已复制`;
        setTimeout(() => { copyBtn.classList.remove("copied"); copyBtn.innerHTML = origHTML; }, 2000);
      } catch {
        const ta = document.createElement("textarea");
        ta.value = currentMarkdown;
        ta.style.cssText = "position:fixed;left:-9999px;";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        copyBtn.textContent = "已复制";
        setTimeout(() => { copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制`; }, 2000);
      }
    });

    wrap.appendChild(toolbar);
    wrap.appendChild(contentArea);

    list.style.display = "none";
    panel.insertBefore(wrap, list);

    // Back button in header
    injectBackBtn(() => {
      wrap.remove();
      list.style.display = "";
      renderSelectPhase();
    });

    // Footer
    const footer = document.createElement("div");
    footer.className = "acr-footer";
    footer.style.justifyContent = "flex-end";

    if (isAIMode) {
      const regenBtn = document.createElement("button");
      regenBtn.className = "acr-btn-secondary";
      regenBtn.type = "button";
      regenBtn.textContent = "重新生成";
      regenBtn.addEventListener("click", () => {
        wrap.remove();
        list.style.display = "";
        renderAIGeneratingPhase();
      });
      footer.appendChild(regenBtn);
    }

    const downloadBtn = document.createElement("button");
    downloadBtn.className = "acr-btn-primary";
    downloadBtn.type = "button";
    downloadBtn.textContent = "下载 .md 文件";

    footer.appendChild(downloadBtn);
    panel.appendChild(footer);

    downloadBtn.addEventListener("click", () => {
      const title = sessionInfo?.title || "AI对话记录";
      downloadMarkdown(currentMarkdown, `${title}.md`);
    });
  }

  // ==================== Helpers ====================
  function removeFooter() {
    const f = shadow.querySelector(".acr-footer");
    if (f) f.remove();
    const pw = shadow.querySelector(".acr-preview-wrap");
    if (pw) pw.remove();
    const lw = shadow.querySelector(".acr-ai-loading-wrap");
    if (lw) lw.remove();
    removeBackBtn();
    list.style.display = "";
  }
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "（空内容）";
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s/g, "")
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[>\-*+]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function markdownToHtml(md: string): string {
  let html = escapeHtml(md);

  // Code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) => {
    return `<pre><code>${code.trim()}</code></pre>`;
  });

  // Headings
  html = html.replace(/^######\s+(.+)$/gm, "<h6>$1</h6>");
  html = html.replace(/^#####\s+(.+)$/gm, "<h5>$1</h5>");
  html = html.replace(/^####\s+(.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^##\s+(.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^#\s+(.+)$/gm, "<h1>$1</h1>");

  // HR
  html = html.replace(/^---$/gm, "<hr>");

  // Blockquote
  html = html.replace(/^&gt;\s+(.+)$/gm, "<blockquote>$1</blockquote>");

  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  // Italic
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

  // Paragraphs
  html = html.replace(/\n\n/g, "</p><p>");
  html = html.replace(/\n/g, "<br>");
  html = `<p>${html}</p>`;

  // Clean up
  html = html.replace(/<p>(<h[1-6]>)/g, "$1");
  html = html.replace(/(<\/h[1-6]>)<\/p>/g, "$1");
  html = html.replace(/<p>(<hr>)<\/p>/g, "$1");
  html = html.replace(/<p>(<blockquote>)/g, "$1");
  html = html.replace(/(<\/blockquote>)<\/p>/g, "$1");
  html = html.replace(/<p>(<pre>)/g, "$1");
  html = html.replace(/(<\/pre>)<\/p>/g, "$1");
  html = html.replace(/<p>\s*<\/p>/g, "");

  return html;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
