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
  aboutButton: HTMLButtonElement;
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
  logoImg.src = chrome.runtime.getURL("assets/logo-128.png");
  logoImg.alt = "AI Chat Reader";
  floatingButton.appendChild(logoImg);
  setupFabDrag(floatingButton);

  const panel = document.createElement("div");
  panel.className = "acr-panel";

  // 拖拽手柄
  const resizeHandle = document.createElement("div");
  resizeHandle.className = "acr-resize-handle";
  setupResize(resizeHandle, panel);

  // Header — single row: subtitle left, action buttons right
  const header = document.createElement("div");
  header.className = "acr-header";

  const subtitle = document.createElement("div");
  subtitle.className = "acr-subtitle";
  subtitle.textContent = "正在识别用户提问";

  const actions = document.createElement("div");
  actions.className = "acr-actions";

  const settingsButton = document.createElement("button");
  settingsButton.className = "acr-icon-btn";
  settingsButton.type = "button";
  settingsButton.title = "设置";
  settingsButton.setAttribute("data-tooltip", "设置");
  settingsButton.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;

  const exportButton = document.createElement("button");
  exportButton.className = "acr-icon-btn";
  exportButton.type = "button";
  exportButton.title = "导出对话";
  exportButton.setAttribute("data-tooltip", "导出对话");
  exportButton.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;

  const closeButton = document.createElement("button");
  closeButton.className = "acr-icon-btn";
  closeButton.type = "button";
  closeButton.title = "关闭侧边栏";
  closeButton.setAttribute("data-tooltip", "关闭");
  closeButton.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>`;

  const aboutButton = document.createElement("button");
  aboutButton.className = "acr-icon-btn";
  aboutButton.type = "button";
  aboutButton.title = "关于";
  aboutButton.setAttribute("data-tooltip", "关于");
  aboutButton.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;

  actions.appendChild(aboutButton);
  actions.appendChild(settingsButton);
  actions.appendChild(exportButton);
  actions.appendChild(closeButton);

  header.appendChild(subtitle);
  header.appendChild(actions);

  const list = document.createElement("div");
  list.className = "acr-list";

  panel.appendChild(resizeHandle);
  panel.appendChild(header);
  panel.appendChild(list);

  shadow.appendChild(style);
  shadow.appendChild(floatingButton);
  shadow.appendChild(panel);

  return { container, shadow, floatingButton, panel, list, statusText: subtitle, closeButton, exportButton, settingsButton, aboutButton };
}

function setupFabDrag(fab: HTMLButtonElement) {
  let isDragging = false;
  let hasMoved = false;
  let startX = 0;
  let startY = 0;
  let fabX = 0;
  let fabY = 0;

  function onPointerDown(e: PointerEvent) {
    isDragging = true;
    hasMoved = false;
    startX = e.clientX;
    startY = e.clientY;
    const rect = fab.getBoundingClientRect();
    fabX = rect.left;
    fabY = rect.top;
    fab.classList.add("dragging");
    fab.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function onPointerMove(e: PointerEvent) {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!hasMoved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
    hasMoved = true;

    const newX = Math.max(0, Math.min(fabX + dx, window.innerWidth - fab.offsetWidth));
    const newY = Math.max(0, Math.min(fabY + dy, window.innerHeight - fab.offsetHeight));

    fab.style.left = newX + "px";
    fab.style.top = newY + "px";
    fab.style.right = "auto";
    fab.style.bottom = "auto";
  }

  function onPointerUp(e: PointerEvent) {
    if (!isDragging) return;
    isDragging = false;
    fab.classList.remove("dragging");
    fab.releasePointerCapture(e.pointerId);

    if (hasMoved) {
      // Suppress the click that follows drag
      const suppress = (ev: Event) => { ev.stopImmediatePropagation(); ev.preventDefault(); };
      fab.addEventListener("click", suppress, { capture: true, once: true });
    }
  }

  fab.addEventListener("pointerdown", onPointerDown);
  fab.addEventListener("pointermove", onPointerMove);
  fab.addEventListener("pointerup", onPointerUp);
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

/* Fab — transparent, draggable */
.acr-fab {
  position: fixed; right: 60px; bottom: 120px;
  width: 40px; height: 40px; border-radius: 0;
  background: transparent; border: none;
  box-shadow: none;
  cursor: grab; padding: 0; overflow: visible;
  display: flex; align-items: center; justify-content: center;
  transition: opacity 0.15s;
  opacity: 0.85;
  touch-action: none; user-select: none;
}
.acr-fab:hover { opacity: 1; }
.acr-fab.dragging { cursor: grabbing; opacity: 0.7; }
.acr-fab img { width: 100%; height: 100%; object-fit: contain; pointer-events: none; }

/* Panel */
.acr-panel {
  position: fixed; right: 0; top: 0; height: 100vh; width: 380px;
  background: #fafaf9; border-left: 1px solid #e7e5e4;
  box-shadow: -6px 0 20px rgba(0,0,0,0.05);
  transform: translateX(100%); transition: transform 0.2s ease;
  display: flex; flex-direction: column;
  font-family: inherit; color: #1c1917; font-size: 14px; line-height: 1.5;
}

/* Resize handle */
.acr-resize-handle {
  position: absolute; left: -3px; top: 0; width: 6px; height: 100%;
  cursor: col-resize; z-index: 10;
  background: transparent; transition: background 0.15s;
}
.acr-resize-handle:hover, .acr-resize-handle:active { background: #1c1917; }

/* Header — single row */
.acr-header { padding: 10px 16px; border-bottom: 1px solid #e7e5e4; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.acr-subtitle { font-size: 12px; color: #a8a29e; flex: 1; min-width: 0; }
.acr-back-btn { flex-shrink: 0; }
.acr-actions { display: flex; gap: 2px; align-items: center; flex-shrink: 0; }

/* Buttons — borderless, darken on hover */
.acr-icon-btn {
  width: 30px; height: 30px; border-radius: 6px;
  border: none; background: transparent; color: #78716c;
  cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
  padding: 0; transition: all 0.15s;
  position: relative;
}
.acr-icon-btn:hover { background: rgba(0,0,0,0.08); color: #1c1917; }
.acr-icon-btn.spinning svg { animation: acr-spin 0.8s linear infinite; }
@keyframes acr-spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }

/* Custom tooltip for icon buttons - 向下展示 */
.acr-icon-btn::after {
  content: attr(data-tooltip);
  position: absolute;
  top: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 8px;
  background: #1c1917;
  color: #fff;
  font-size: 11px;
  border-radius: 4px;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.15s, visibility 0.15s;
  pointer-events: none;
  z-index: 1000;
}
.acr-icon-btn::before {
  content: "";
  position: absolute;
  top: calc(100% + 2px);
  left: 50%;
  transform: translateX(-50%);
  border: 4px solid transparent;
  border-bottom-color: #1c1917;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.15s, visibility 0.15s;
  pointer-events: none;
  z-index: 1000;
}
.acr-icon-btn:hover::after,
.acr-icon-btn:hover::before {
  opacity: 1;
  visibility: visible;
}
/* Hide tooltip if no data-tooltip attribute */
.acr-icon-btn:not([data-tooltip])::after,
.acr-icon-btn:not([data-tooltip])::before {
  display: none;
}

.acr-btn-outline {
  padding: 4px 12px; border-radius: 6px;
  border: 1px solid #1c1917; background: #fff; color: #1c1917;
  cursor: pointer; font-size: 12px; font-weight: 500;
  transition: all 0.15s; flex-shrink: 0;
}
.acr-btn-outline:hover { background: #1c1917; color: #fff; }

.acr-btn-primary {
  padding: 6px 16px; border-radius: 8px; border: none;
  background: #1c1917; color: #fafaf9;
  cursor: pointer; font-size: 13px; font-weight: 500; transition: background 0.15s;
}
.acr-btn-primary:hover { background: #292524; }
.acr-btn-primary:disabled { background: #a8a29e; cursor: not-allowed; }

.acr-btn-secondary {
  padding: 6px 16px; border-radius: 8px; border: 1px solid #d6d3d1;
  background: #fff; color: #44403c;
  cursor: pointer; font-size: 13px; font-weight: 500; transition: all 0.15s;
}
.acr-btn-secondary:hover { background: #f5f5f4; border-color: #a8a29e; }

.acr-btn-ghost {
  padding: 6px 12px; border-radius: 8px; border: none;
  background: transparent; color: #78716c;
  cursor: pointer; font-size: 13px; transition: background 0.15s;
}
.acr-btn-ghost:hover { background: #f5f5f4; }

/* List */
.acr-list { overflow-y: auto; flex: 1; }

/* Normal item */
.acr-item {
  width: 100%; padding: 10px 16px; margin-bottom: 0;
  border-radius: 0; background: transparent; border: none; border-bottom: 1px solid #e7e5e4;
  text-align: left; font-size: 13px; line-height: 1.5; color: #1c1917;
  cursor: pointer; transition: all 0.15s; box-sizing: border-box;
}
.acr-item:hover { background: #f5f5f4; }
.acr-item:last-child { border-bottom: none; }

/* Export card */
.acr-export-card {
  width: 100%; padding: 10px 16px; margin-bottom: 0;
  border-radius: 0; background: transparent; border: none; border-bottom: 1px solid #e7e5e4;
  text-align: left; font-size: 13px; line-height: 1.5; color: #1c1917;
  cursor: pointer; transition: all 0.15s;
  display: flex; gap: 10px; align-items: flex-start; box-sizing: border-box;
}
.acr-export-card:hover { background: #f5f5f4; }
.acr-export-card.selected { background: #f5f5f4; border-left: 3px solid #1c1917; }
.acr-export-card input[type="checkbox"] {
  margin-top: 2px; flex-shrink: 0; accent-color: #1c1917;
  width: 16px; height: 16px; cursor: pointer;
}
.acr-card-content { flex: 1; min-width: 0; }
.acr-card-user { font-weight: 500; color: #1c1917; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.acr-card-ai { margin-top: 3px; color: #a8a29e; font-size: 12px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

/* Footer */
.acr-footer {
  padding: 10px 14px; border-top: 1px solid #e7e5e4;
  display: flex; gap: 8px; align-items: center; justify-content: space-between;
  background: #fafaf9; flex-shrink: 0;
}
.acr-footer .acr-select-info { font-size: 12px; color: #a8a29e; margin-right: auto; }

/* Preview area */
.acr-preview-wrap {
  flex: 1; display: flex; flex-direction: column; overflow: hidden;
}
.acr-preview-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 14px; border-bottom: 1px solid #e7e5e4; flex-shrink: 0;
}
.acr-preview-toolbar .acr-tab {
  padding: 4px 10px; border-radius: 6px; border: none;
  background: transparent; color: #78716c;
  cursor: pointer; font-size: 12px; font-weight: 500; transition: all 0.15s;
}
.acr-preview-toolbar .acr-tab.active { background: #f5f5f4; color: #1c1917; }
.acr-preview-toolbar .acr-tab:hover { background: #f5f5f4; }
.acr-copy-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 10px; border-radius: 6px; border: none;
  background: transparent; color: #78716c; cursor: pointer; font-size: 12px;
  transition: all 0.15s;
}
.acr-copy-btn:hover { background: rgba(0,0,0,0.08); color: #1c1917; }
.acr-copy-btn.copied { border-color: #86efac; color: #16a34a; background: #f0fdf4; }

.acr-preview-content {
  flex: 1; overflow-y: auto; padding: 14px 16px;
  font-size: 13px; line-height: 1.7; color: #292524;
}
.acr-preview-content pre {
  white-space: pre-wrap; word-break: break-word; margin: 0;
  font-family: "SF Mono", "Fira Code", "Cascadia Code", Menlo, Consolas, monospace;
  font-size: 12px; line-height: 1.6; color: #292524;
  background: #f5f5f4; border-radius: 8px; padding: 14px; border: 1px solid #e7e5e4;
}
/* Rendered markdown styles */
.acr-preview-content.rendered h1 { font-size: 20px; font-weight: 700; margin: 0 0 12px; color: #1c1917; border-bottom: 1px solid #e7e5e4; padding-bottom: 8px; }
.acr-preview-content.rendered h2 { font-size: 16px; font-weight: 600; margin: 16px 0 8px; color: #1c1917; }
.acr-preview-content.rendered blockquote { margin: 8px 0; padding: 4px 12px; border-left: 3px solid #a8a29e; color: #78716c; font-size: 12px; }
.acr-preview-content.rendered hr { border: none; border-top: 1px solid #d6d3d1; margin: 16px 0; }
.acr-preview-content.rendered p { margin: 6px 0; }
.acr-preview-content.rendered strong { font-weight: 600; color: #1c1917; }
.acr-preview-content.rendered code { background: #f5f5f4; padding: 1px 5px; border-radius: 4px; font-size: 12px; font-family: "SF Mono", Menlo, monospace; }
.acr-preview-content.rendered pre code { background: none; padding: 0; }
.acr-preview-content.rendered pre { background: #f5f5f4; border-radius: 8px; padding: 12px; border: 1px solid #e7e5e4; overflow-x: auto; }
.acr-preview-content.rendered h3 { font-size: 14px; font-weight: 600; margin: 14px 0 6px; color: #1c1917; }

/* Settings */
.acr-settings-wrap { flex: 1; overflow-y: auto; padding: 14px 16px; }
.acr-settings-section { margin-bottom: 20px; }
.acr-settings-section-title { font-size: 13px; font-weight: 600; color: #1c1917; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid #e7e5e4; }
.acr-settings-row { margin-bottom: 10px; }
.acr-settings-label { display: block; font-size: 12px; color: #78716c; margin-bottom: 4px; }
.acr-settings-input {
  width: 100%; padding: 6px 10px; border-radius: 6px;
  border: 1px solid #d6d3d1; background: #fff; color: #1c1917;
  font-size: 13px; outline: none; transition: border-color 0.15s;
  box-sizing: border-box;
}
.acr-settings-input:focus { border-color: #1c1917; }
.acr-settings-password-wrap { position: relative; }
.acr-settings-password-wrap .acr-settings-input { padding-right: 32px; }
.acr-settings-eye-btn {
  position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
  background: none; border: none; cursor: pointer; color: #a8a29e; padding: 2px;
  display: flex; align-items: center; justify-content: center;
}
.acr-settings-eye-btn:hover { color: #1c1917; }
.acr-settings-checkbox-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.acr-settings-checkbox { accent-color: #1c1917; width: 16px; height: 16px; cursor: pointer; }
.acr-settings-checkbox-label { font-size: 13px; color: #292524; cursor: pointer; }

/* AI loading */
.acr-ai-loading-wrap {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 40px 20px; text-align: center;
}
.acr-ai-spinner {
  width: 36px; height: 36px; border: 3px solid #d6d3d1; border-top-color: #1c1917;
  border-radius: 50%; animation: acr-spin 0.8s linear infinite; margin-bottom: 16px;
}
.acr-ai-progress { font-size: 13px; color: #78716c; margin-top: 8px; }
.acr-ai-error { color: #dc2626; font-size: 13px; margin-top: 8px; }

/* Streaming progress indicator */
.acr-stream-progress {
  display: flex; align-items: center; gap: 8px; font-size: 13px; color: #78716c;
}
.acr-stream-dot {
  width: 8px; height: 8px; border-radius: 50%; background: #1c1917;
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
  background: rgba(0,0,0,0.35); z-index: 2147483647;
  display: flex; align-items: center; justify-content: center;
  animation: acr-fade-in 0.15s ease;
}
/* 在panel内显示的对话框 */
.acr-dialog-overlay.acr-dialog-in-panel {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.4);
  z-index: 100;
}
.acr-dialog {
  background: #fff; border-radius: 12px; padding: 20px 24px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
  max-width: 320px; width: 90%;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", sans-serif;
}
.acr-dialog-title { font-size: 15px; font-weight: 600; color: #1c1917; margin-bottom: 8px; }
.acr-dialog-body { font-size: 13px; color: #78716c; line-height: 1.6; margin-bottom: 16px; }
.acr-dialog-actions { display: flex; gap: 8px; justify-content: flex-end; }
@keyframes acr-fade-in { from { opacity: 0; } to { opacity: 1; } }

/* Refresh button */
.acr-refresh-btn {
  color: #f97316 !important;
}
.acr-refresh-btn:hover {
  background: rgba(249, 115, 22, 0.1) !important;
  color: #ea580c !important;
}

/* Select header with select-all checkbox */
.acr-select-header {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 16px; border-bottom: 1px solid #d6d3d1;
  background: #f5f5f4; position: sticky; top: 0; z-index: 1;
}
.acr-select-header-label { font-size: 12px; color: #78716c; }

/* Button group for export mode selection */
.acr-btn-group { display: flex; gap: 8px; }

/* About page */
.acr-about-wrap {
  flex: 1; overflow-y: auto; padding: 24px 20px;
  display: flex; flex-direction: column; gap: 20px;
}
.acr-about-header {
  text-align: center; padding-bottom: 16px;
  border-bottom: 1px solid #e7e5e4;
}
.acr-about-logo {
  width: 48px; height: 48px; margin: 0 auto 10px;
  border-radius: 12px; overflow: hidden;
}
.acr-about-logo img { width: 100%; height: 100%; object-fit: contain; }
.acr-about-name { font-size: 16px; font-weight: 600; color: #1c1917; margin-bottom: 4px; }
.acr-about-version { font-size: 12px; color: #a8a29e; }
.acr-about-section { }
.acr-about-section-title {
  font-size: 13px; font-weight: 600; color: #1c1917;
  margin-bottom: 8px; display: flex; align-items: center; gap: 6px;
}
.acr-about-section-title svg { flex-shrink: 0; }
.acr-about-text {
  font-size: 13px; color: #57534e; line-height: 1.7;
}
.acr-about-text p { margin: 4px 0; }
.acr-about-row {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; color: #57534e; padding: 6px 0;
}
.acr-about-row-label {
  font-weight: 500; color: #1c1917; min-width: 80px; flex-shrink: 0;
}
.acr-about-link {
  color: #1c1917; text-decoration: none; font-weight: 500;
  border-bottom: 1px solid #d6d3d1; transition: border-color 0.15s;
}
.acr-about-link:hover { border-color: #1c1917; }
.acr-about-badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px; border-radius: 4px;
  background: #f5f5f4; font-size: 11px; color: #78716c;
}

/* QR code trigger & popover */
.acr-about-qr-trigger {
  position: relative; display: inline-flex; align-items: center;
  vertical-align: middle;
  margin-left: -4px; cursor: pointer; color: #78716c;
  transition: color 0.15s;
}
.acr-about-qr-trigger:hover { color: #1c1917; }
.acr-about-qr-popover {
  display: none; position: absolute; bottom: calc(100% + 8px); left: 50%;
  transform: translateX(-50%); z-index: 100;
  padding: 12px; border-radius: 10px;
  background: #fff; border: 1px solid #e7e5e4;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  text-align: center; white-space: nowrap;
}
.acr-about-qr-popover::after {
  content: ""; position: absolute; top: 100%; left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent; border-top-color: #fff;
}
.acr-about-qr-trigger:hover .acr-about-qr-popover { display: block; }
.acr-about-qr-popover img {
  width: 130px; height: 130px; border-radius: 6px;
  border: 1px solid #e7e5e4; object-fit: contain;
}
.acr-about-qr-hint {
  margin-top: 6px; font-size: 11px; color: #a8a29e;
}
  `;
}
