type UIRefs = {
  container: HTMLDivElement;
  shadow: ShadowRoot;
  floatingButton: HTMLButtonElement;
  panel: HTMLDivElement;
  list: HTMLDivElement;
  statusText: HTMLDivElement;
  closeButton: HTMLButtonElement;
  exportButton: HTMLButtonElement;
  settingsButton: HTMLButtonElement;
};

export function createUI(): UIRefs {
  const container = document.createElement("div");
  container.id = "ai-chat-reader-root";
  Object.assign(container.style, { position: "fixed", right: "0", bottom: "0", zIndex: "2147483647" });

  const shadow = container.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = getStyles();

  const floatingButton = document.createElement("button");
  floatingButton.className = "acr-fab";
  floatingButton.type = "button";
  floatingButton.title = "打开 AI 会话侧边栏";
  const logoImg = document.createElement("img");
  logoImg.src = chrome.runtime.getURL("assets/logo.png");
  logoImg.alt = "AI Chat Reader";
  floatingButton.appendChild(logoImg);

  const panel = document.createElement("div");
  panel.className = "acr-panel";

  // 拖拽手柄
  const resizeHandle = document.createElement("div");
  resizeHandle.className = "acr-resize-handle";
  setupResize(resizeHandle, panel);

  // Header
  const header = document.createElement("div");
  header.className = "acr-header";

  const headerTop = document.createElement("div");
  headerTop.className = "acr-header-top";
  const title = document.createElement("div");
  title.className = "acr-title";
  title.textContent = "会话速览";
  const closeButton = document.createElement("button");
  closeButton.className = "acr-icon-btn";
  closeButton.type = "button";
  closeButton.title = "关闭侧边栏";
  closeButton.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>`;
  headerTop.appendChild(title);
  headerTop.appendChild(closeButton);

  const headerBottom = document.createElement("div");
  headerBottom.className = "acr-header-bottom";
  const subtitle = document.createElement("div");
  subtitle.className = "acr-subtitle";
  subtitle.textContent = "正在识别用户提问";

  const actions = document.createElement("div");
  actions.className = "acr-actions";

  const settingsButton = document.createElement("button");
  settingsButton.className = "acr-icon-btn";
  settingsButton.type = "button";
  settingsButton.title = "设置";
  settingsButton.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;

  const exportButton = document.createElement("button");
  exportButton.className = "acr-icon-btn";
  exportButton.type = "button";
  exportButton.title = "导出对话";
  exportButton.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;

  actions.appendChild(settingsButton);
  actions.appendChild(exportButton);
  headerBottom.appendChild(subtitle);
  headerBottom.appendChild(actions);
  header.appendChild(headerTop);
  header.appendChild(headerBottom);

  const list = document.createElement("div");
  list.className = "acr-list";

  panel.appendChild(resizeHandle);
  panel.appendChild(header);
  panel.appendChild(list);

  shadow.appendChild(style);
  shadow.appendChild(floatingButton);
  shadow.appendChild(panel);

  return { container, shadow, floatingButton, panel, list, statusText: subtitle, closeButton, exportButton, settingsButton };
}

function setupResize(handle: HTMLDivElement, panel: HTMLDivElement) {
  let startX = 0;
  let startW = 0;

  function onMouseMove(e: MouseEvent) {
    const delta = startX - e.clientX;
    const newW = Math.min(Math.max(startW + delta, 320), window.innerWidth * 0.8);
    panel.style.width = newW + "px";
  }
  function onMouseUp() {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }

  handle.addEventListener("mousedown", (e) => {
    e.preventDefault();
    startX = e.clientX;
    startW = panel.getBoundingClientRect().width;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });
}

function getStyles(): string {
  return `
:host { all: initial; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft Yahei", sans-serif; }

/* Fab */
.acr-fab {
  position: fixed; right: 24px; bottom: 24px;
  width: 48px; height: 48px; border-radius: 9999px;
  background: #fff; border: none;
  box-shadow: 0 4px 14px rgba(0,0,0,0.12);
  cursor: pointer; padding: 0; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  transition: transform 0.15s, box-shadow 0.15s;
}
.acr-fab:hover { transform: scale(1.06); box-shadow: 0 6px 20px rgba(0,0,0,0.18); }
.acr-fab img { width: 100%; height: 100%; border-radius: 9999px; object-fit: cover; }

/* Panel */
.acr-panel {
  position: fixed; right: 0; top: 0; height: 100vh; width: 380px;
  background: #ffffff; border-left: 1px solid #e5e7eb;
  box-shadow: -8px 0 24px rgba(15,23,42,0.06);
  transform: translateX(100%); transition: transform 0.2s ease;
  display: flex; flex-direction: column;
  font-family: inherit; color: #0f172a; font-size: 14px; line-height: 1.5;
}

/* Resize handle */
.acr-resize-handle {
  position: absolute; left: -3px; top: 0; width: 6px; height: 100%;
  cursor: col-resize; z-index: 10;
  background: transparent; transition: background 0.15s;
}
.acr-resize-handle:hover, .acr-resize-handle:active { background: #3b82f6; }

/* Header */
.acr-header { padding: 14px 16px 10px; border-bottom: 1px solid #f1f5f9; }
.acr-header-top { display: flex; align-items: center; justify-content: space-between; }
.acr-header-bottom { display: flex; align-items: center; justify-content: space-between; margin-top: 6px; }
.acr-title { font-size: 15px; font-weight: 600; color: #0f172a; }
.acr-subtitle { font-size: 12px; color: #94a3b8; }
.acr-actions { display: flex; gap: 6px; align-items: center; flex-shrink: 0; }

/* Buttons */
.acr-icon-btn {
  width: 28px; height: 28px; border-radius: 6px;
  border: 1px solid #e5e7eb; background: #fff; color: #64748b;
  cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
  padding: 0; transition: all 0.15s;
}
.acr-icon-btn:hover { background: #f8fafc; color: #3b82f6; border-color: #93c5fd; }
.acr-icon-btn.spinning svg { animation: acr-spin 0.8s linear infinite; }
@keyframes acr-spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }

.acr-btn-outline {
  padding: 4px 12px; border-radius: 6px;
  border: 1px solid #3b82f6; background: #fff; color: #3b82f6;
  cursor: pointer; font-size: 12px; font-weight: 500;
  transition: all 0.15s; flex-shrink: 0;
}
.acr-btn-outline:hover { background: #3b82f6; color: #fff; }

.acr-btn-primary {
  padding: 6px 16px; border-radius: 8px; border: none;
  background: #3b82f6; color: #fff;
  cursor: pointer; font-size: 13px; font-weight: 500; transition: background 0.15s;
}
.acr-btn-primary:hover { background: #2563eb; }
.acr-btn-primary:disabled { background: #93c5fd; cursor: not-allowed; }

.acr-btn-secondary {
  padding: 6px 16px; border-radius: 8px; border: 1px solid #e2e8f0;
  background: #f8fafc; color: #475569;
  cursor: pointer; font-size: 13px; font-weight: 500; transition: all 0.15s;
}
.acr-btn-secondary:hover { background: #f1f5f9; border-color: #cbd5e1; }

.acr-btn-ghost {
  padding: 6px 12px; border-radius: 8px; border: none;
  background: transparent; color: #64748b;
  cursor: pointer; font-size: 13px; transition: background 0.15s;
}
.acr-btn-ghost:hover { background: #f1f5f9; }

/* List */
.acr-list { padding: 6px 0 20px; overflow-y: auto; flex: 1; }

/* Normal item */
.acr-item {
  width: 100%; padding: 10px 16px; margin-bottom: 0;
  border-radius: 0; background: #fff; border: none; border-bottom: 1px solid #f1f5f9;
  text-align: left; font-size: 13px; line-height: 1.5; color: #1e293b;
  cursor: pointer; transition: all 0.15s; box-sizing: border-box;
}
.acr-item:hover { background: #eff6ff; }
.acr-item:last-child { border-bottom: none; }

/* Export card */
.acr-export-card {
  width: 100%; padding: 10px 16px; margin-bottom: 0;
  border-radius: 0; background: #fff; border: none; border-bottom: 1px solid #f1f5f9;
  text-align: left; font-size: 13px; line-height: 1.5; color: #1e293b;
  cursor: pointer; transition: all 0.15s;
  display: flex; gap: 10px; align-items: flex-start; box-sizing: border-box;
}
.acr-export-card:hover { background: #eff6ff; }
.acr-export-card.selected { background: #eff6ff; border-left: 3px solid #3b82f6; }
.acr-export-card input[type="checkbox"] {
  margin-top: 2px; flex-shrink: 0; accent-color: #3b82f6;
  width: 16px; height: 16px; cursor: pointer;
}
.acr-card-content { flex: 1; min-width: 0; }
.acr-card-user { font-weight: 500; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.acr-card-ai { margin-top: 3px; color: #94a3b8; font-size: 12px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

/* Footer */
.acr-footer {
  padding: 10px 14px; border-top: 1px solid #f1f5f9;
  display: flex; gap: 8px; align-items: center; justify-content: space-between;
  background: #fff; flex-shrink: 0;
}
.acr-footer .acr-select-info { font-size: 12px; color: #94a3b8; margin-right: auto; }

/* Preview area */
.acr-preview-wrap {
  flex: 1; display: flex; flex-direction: column; overflow: hidden;
}
.acr-preview-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 14px; border-bottom: 1px solid #f1f5f9; flex-shrink: 0;
}
.acr-preview-toolbar .acr-tab {
  padding: 4px 10px; border-radius: 6px; border: none;
  background: transparent; color: #64748b;
  cursor: pointer; font-size: 12px; font-weight: 500; transition: all 0.15s;
}
.acr-preview-toolbar .acr-tab.active { background: #eff6ff; color: #3b82f6; }
.acr-preview-toolbar .acr-tab:hover { background: #f1f5f9; }
.acr-copy-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 10px; border-radius: 6px; border: 1px solid #e2e8f0;
  background: #fff; color: #475569; cursor: pointer; font-size: 12px;
  transition: all 0.15s;
}
.acr-copy-btn:hover { background: #f8fafc; border-color: #93c5fd; color: #3b82f6; }
.acr-copy-btn.copied { border-color: #86efac; color: #16a34a; background: #f0fdf4; }

.acr-preview-content {
  flex: 1; overflow-y: auto; padding: 14px 16px;
  font-size: 13px; line-height: 1.7; color: #334155;
}
.acr-preview-content pre {
  white-space: pre-wrap; word-break: break-word; margin: 0;
  font-family: "SF Mono", "Fira Code", "Cascadia Code", Menlo, Consolas, monospace;
  font-size: 12px; line-height: 1.6; color: #334155;
  background: #f8fafc; border-radius: 8px; padding: 14px; border: 1px solid #f1f5f9;
}
/* Rendered markdown styles */
.acr-preview-content.rendered h1 { font-size: 20px; font-weight: 700; margin: 0 0 12px; color: #0f172a; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; }
.acr-preview-content.rendered h2 { font-size: 16px; font-weight: 600; margin: 16px 0 8px; color: #0f172a; }
.acr-preview-content.rendered blockquote { margin: 8px 0; padding: 4px 12px; border-left: 3px solid #93c5fd; color: #64748b; font-size: 12px; }
.acr-preview-content.rendered hr { border: none; border-top: 1px solid #e2e8f0; margin: 16px 0; }
.acr-preview-content.rendered p { margin: 6px 0; }
.acr-preview-content.rendered strong { font-weight: 600; color: #0f172a; }
.acr-preview-content.rendered code { background: #f1f5f9; padding: 1px 5px; border-radius: 4px; font-size: 12px; font-family: "SF Mono", Menlo, monospace; }
.acr-preview-content.rendered pre code { background: none; padding: 0; }
.acr-preview-content.rendered pre { background: #f8fafc; border-radius: 8px; padding: 12px; border: 1px solid #f1f5f9; overflow-x: auto; }
.acr-preview-content.rendered h3 { font-size: 14px; font-weight: 600; margin: 14px 0 6px; color: #0f172a; }

/* Settings */
.acr-settings-wrap { flex: 1; overflow-y: auto; padding: 14px 16px; }
.acr-settings-section { margin-bottom: 20px; }
.acr-settings-section-title { font-size: 13px; font-weight: 600; color: #0f172a; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid #f1f5f9; }
.acr-settings-row { margin-bottom: 10px; }
.acr-settings-label { display: block; font-size: 12px; color: #64748b; margin-bottom: 4px; }
.acr-settings-input {
  width: 100%; padding: 6px 10px; border-radius: 6px;
  border: 1px solid #e2e8f0; background: #fff; color: #0f172a;
  font-size: 13px; outline: none; transition: border-color 0.15s;
  box-sizing: border-box;
}
.acr-settings-input:focus { border-color: #3b82f6; }
.acr-settings-password-wrap { position: relative; }
.acr-settings-password-wrap .acr-settings-input { padding-right: 32px; }
.acr-settings-eye-btn {
  position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
  background: none; border: none; cursor: pointer; color: #94a3b8; padding: 2px;
  display: flex; align-items: center; justify-content: center;
}
.acr-settings-eye-btn:hover { color: #3b82f6; }
.acr-settings-checkbox-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.acr-settings-checkbox { accent-color: #3b82f6; width: 16px; height: 16px; cursor: pointer; }
.acr-settings-checkbox-label { font-size: 13px; color: #334155; cursor: pointer; }

/* AI loading */
.acr-ai-loading-wrap {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 40px 20px; text-align: center;
}
.acr-ai-spinner {
  width: 36px; height: 36px; border: 3px solid #e2e8f0; border-top-color: #3b82f6;
  border-radius: 50%; animation: acr-spin 0.8s linear infinite; margin-bottom: 16px;
}
.acr-ai-progress { font-size: 13px; color: #64748b; margin-top: 8px; }
.acr-ai-error { color: #ef4444; font-size: 13px; margin-top: 8px; }

/* Streaming progress indicator */
.acr-stream-progress {
  display: flex; align-items: center; gap: 8px; font-size: 13px; color: #64748b;
}
.acr-stream-dot {
  width: 8px; height: 8px; border-radius: 50%; background: #3b82f6;
  animation: acr-pulse 1.2s ease-in-out infinite;
  flex-shrink: 0;
}
.acr-stream-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.acr-stream-placeholder {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 60px 20px; text-align: center;
}
@keyframes acr-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.75); }
}

/* Session switch dialog */
.acr-dialog-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.3); z-index: 2147483647;
  display: flex; align-items: center; justify-content: center;
  animation: acr-fade-in 0.15s ease;
}
.acr-dialog {
  background: #fff; border-radius: 12px; padding: 20px 24px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.16);
  max-width: 320px; width: 90%;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", sans-serif;
}
.acr-dialog-title { font-size: 15px; font-weight: 600; color: #0f172a; margin-bottom: 8px; }
.acr-dialog-body { font-size: 13px; color: #64748b; line-height: 1.6; margin-bottom: 16px; }
.acr-dialog-actions { display: flex; gap: 8px; justify-content: flex-end; }
@keyframes acr-fade-in { from { opacity: 0; } to { opacity: 1; } }

/* Select header with select-all checkbox */
.acr-select-header {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 16px; border-bottom: 1px solid #e2e8f0;
  background: #f8fafc; position: sticky; top: 0; z-index: 1;
}
.acr-select-header-label { font-size: 12px; color: #64748b; }

/* Button group for export mode selection */
.acr-btn-group { display: flex; gap: 8px; }
  `;
}
