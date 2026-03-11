import { getActiveStrategy } from "./strategies/index.js";
import type { ChatTurn } from "./strategies/types.js";
import { createUI } from "./ui/createUI.js";
import { enterExportMode } from "./ui/exportMode.js";
import { openSettings } from "./ui/settingsUI.js";
import { openAbout } from "./ui/aboutUI.js";
import { extractPreview, flashTarget, scrollToMessage } from "./utils/dom.js";
import { debounce } from "./utils/debounce.js";

function bootstrap() {
  const strategy = getActiveStrategy();
  if (!strategy) {
    return;
  }

  const state: {
    isOpen: boolean;
    isExportMode: boolean;
    isSettings: boolean;
    isAbout: boolean;
    messages: Array<{ id: string; text: string; node: HTMLElement }>;
    chatTurns: ChatTurn[];
  } = {
    isOpen: false,
    isExportMode: false,
    isSettings: false,
    isAbout: false,
    messages: [],
    chatTurns: [],
  };

  const ui = createUI();
  const {
    container,
    shadow,
    floatingButton,
    panel,
    list,
    statusText,
    closeButton,
    exportButton,
    settingsButton,
    aboutButton,
  } = ui;

  document.documentElement.appendChild(container);

  strategy.init();

  strategy.onDataUpdate((turns) => {
    state.chatTurns = turns;
    if (!state.isExportMode && !state.isSettings && !state.isAbout) {
      renderTurnsList();
    }
  });

  // 监听加载状态变化
  if (strategy.onLoadingStatusChange) {
    strategy.onLoadingStatusChange((loadStatus) => {
      if (state.isExportMode || state.isSettings || state.isAbout) return;
      const turns = state.chatTurns;
      if (loadStatus.state === "loading") {
        statusText.textContent = `正在加载对话数据… 已获取 ${turns.length} 轮`;
      } else if (loadStatus.state === "done") {
        if (turns.length === 0) {
          statusText.textContent = "未获取到数据，请滚动页面后重试";
        } else {
          statusText.textContent = `共 ${turns.length} 轮对话（已全部加载）`;
        }
      }
    });
  }

  // 监听会话切换
  if (strategy.onSessionChange) {
    strategy.onSessionChange((_sessionId) => {
      if (!state.isOpen) return;

      // 如果当前在导出模式或设置页，弹出确认框
      if (state.isExportMode || state.isSettings || state.isAbout) {
        showSessionSwitchDialog(
          shadow,
          panel,
          () => {
            // 确认：退回列表页
            exitCurrentMode();
            renderTurnsList();
          },
          () => {
            // 用户选择留在当前，显示刷新按钮
            showRefreshButton();
          }
        );
      }
    });
  }

  /** 在header的actions区域添加刷新按钮 */
  function showRefreshButton() {
    const actions = panel.querySelector(".acr-actions") as HTMLDivElement;
    if (!actions) return;
    
    // 如果已存在刷新按钮则不重复添加
    if (actions.querySelector(".acr-refresh-btn")) return;
    
    const refreshBtn = document.createElement("button");
    refreshBtn.className = "acr-icon-btn acr-refresh-btn";
    refreshBtn.type = "button";
    refreshBtn.title = "刷新对话数据";
    refreshBtn.setAttribute("data-tooltip", "刷新");
    refreshBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="m3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`;
    
    refreshBtn.addEventListener("click", () => {
      // 退出当前模式并刷新列表
      exitCurrentMode();
      renderTurnsList();
      // 移除刷新按钮
      refreshBtn.remove();
    });
    
    // 插入到第一个位置
    actions.insertBefore(refreshBtn, actions.firstChild);
  }

  floatingButton.addEventListener("click", () => {
    state.isOpen = !state.isOpen;
    panel.style.transform = state.isOpen ? "translateX(0)" : "translateX(100%)";
  });

  closeButton.addEventListener("click", () => {
    state.isOpen = false;
    exitCurrentMode();
    panel.style.transform = "translateX(100%)";
  });

  exportButton.addEventListener("click", () => {
    // 如果已经在导出模式，则关闭并返回列表
    if (state.isExportMode) {
      exitCurrentMode();
      renderTurnsList();
      return;
    }
    if (state.chatTurns.length === 0) {
      alert("暂无对话数据，请等待页面加载对话后重试");
      return;
    }
    // 如果在设置页或关于页，先清理
    if (state.isSettings || state.isAbout) {
      exitCurrentMode();
    }
    state.isExportMode = true;
    enterExportMode({
      shadow,
      list,
      panel,
      turns: state.chatTurns,
      sessionInfo: strategy.getSessionInfo(),
      onExit: () => {
        state.isExportMode = false;
        renderTurnsList();
      },
    });
  });

  settingsButton.addEventListener("click", () => {
    // 如果已经在设置页，则关闭并返回列表
    if (state.isSettings) {
      exitCurrentMode();
      renderTurnsList();
      return;
    }
    if (state.isExportMode || state.isAbout) {
      exitCurrentMode();
    }
    state.isSettings = true;
    openSettings({
      shadow,
      panel,
      list,
      onClose: () => {
        state.isSettings = false;
        renderTurnsList();
      },
    });
  });

  aboutButton.addEventListener("click", () => {
    // 如果已经在关于页，则关闭并返回列表
    if (state.isAbout) {
      exitCurrentMode();
      renderTurnsList();
      return;
    }
    if (state.isExportMode || state.isSettings) {
      exitCurrentMode();
    }
    state.isAbout = true;
    openAbout({
      shadow,
      panel,
      list,
      onClose: () => {
        state.isAbout = false;
        renderTurnsList();
      },
    });
  });

  /** 退出当前所有子模式（导出 / 设置 / 关于），恢复列表 */
  function exitCurrentMode() {
    state.isExportMode = false;
    state.isSettings = false;
    state.isAbout = false;
    // 清理导出模式残留元素
    const footer = shadow.querySelector(".acr-footer");
    if (footer) footer.remove();
    const previewWrap = shadow.querySelector(".acr-preview-wrap");
    if (previewWrap) previewWrap.remove();
    const loadingWrap = shadow.querySelector(".acr-ai-loading-wrap");
    if (loadingWrap) loadingWrap.remove();
    // 清理设置页残留
    const settingsWrap = shadow.querySelector(".acr-settings-wrap");
    if (settingsWrap) settingsWrap.remove();
    // 清理关于页残留
    const aboutWrap = shadow.querySelector(".acr-about-wrap");
    if (aboutWrap) aboutWrap.remove();
    // 清理 header 中的返回按钮
    const backBtn = shadow.querySelector(".acr-back-btn");
    if (backBtn) backBtn.remove();
    list.style.display = "";
  }

  const scheduleRefresh = debounce(refreshMessages, 300);

  const observer = new MutationObserver(() => {
    if (!state.isExportMode && !state.isSettings && !state.isAbout) {
      scheduleRefresh();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  refreshMessages();

  function refreshMessages() {
    const nodes = strategy.getUserMessageElements();
    state.messages = nodes.map((node, index) => ({
      id: `${strategy.name}-${index}`,
      text: extractPreview(node),
      node,
    }));

    if (!state.isExportMode && !state.isSettings && !state.isAbout) {
      if (state.chatTurns.length > 0) {
        renderTurnsList();
      } else {
        renderDomList();
      }
    }
  }

  function renderTurnsList() {
    list.innerHTML = "";
    const turns = state.chatTurns;

    if (turns.length === 0) {
      statusText.textContent = "暂未识别到对话内容。";
      return;
    }

    statusText.textContent = `共 ${turns.length} 轮对话（已全部加载）`;

    for (const turn of turns) {
      const item = document.createElement("button");
      item.className = "acr-item";
      item.type = "button";
      const preview = turn.user.content.replace(/\s+/g, " ").trim();
      item.textContent =
        (preview.length > 80 ? `${preview.slice(0, 80)}…` : preview) ||
        "（空内容）";

      item.addEventListener("click", () => {
        scrollToMessage(turn.user.content);
      });

      list.appendChild(item);
    }
  }

  function renderDomList() {
    list.innerHTML = "";
    if (state.messages.length === 0) {
      statusText.textContent = "暂未识别到用户提问内容。";
      return;
    }

    statusText.textContent = `共 ${state.messages.length} 条用户对话`;

    for (const message of state.messages) {
      const item = document.createElement("button");
      item.className = "acr-item";
      item.type = "button";
      item.textContent = message.text || "（空内容）";
      item.addEventListener("click", () => {
        message.node.scrollIntoView({ behavior: "smooth", block: "center" });
        flashTarget(message.node);
      });
      list.appendChild(item);
    }
  }
}

/** 显示会话切换确认对话框 - 在插件panel内显示 */
function showSessionSwitchDialog(
  shadow: ShadowRoot,
  panel: HTMLDivElement,
  onConfirm: () => void,
  onStay: () => void
) {
  // 防重复
  const existing = shadow.querySelector(".acr-dialog-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.className = "acr-dialog-overlay acr-dialog-in-panel";

  const dialog = document.createElement("div");
  dialog.className = "acr-dialog";

  const title = document.createElement("div");
  title.className = "acr-dialog-title";
  title.textContent = "对话已切换";

  const body = document.createElement("div");
  body.className = "acr-dialog-body";
  body.textContent = "检测到你切换了对话，是否返回列表查看新对话？";

  const actions = document.createElement("div");
  actions.className = "acr-dialog-actions";

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "acr-btn-secondary";
  cancelBtn.type = "button";
  cancelBtn.textContent = "留在当前";
  cancelBtn.addEventListener("click", () => {
    overlay.remove();
    onStay();
  });

  const confirmBtn = document.createElement("button");
  confirmBtn.className = "acr-btn-primary";
  confirmBtn.type = "button";
  confirmBtn.textContent = "返回列表";
  confirmBtn.addEventListener("click", () => {
    overlay.remove();
    onConfirm();
  });

  actions.appendChild(cancelBtn);
  actions.appendChild(confirmBtn);
  dialog.appendChild(title);
  dialog.appendChild(body);
  dialog.appendChild(actions);
  overlay.appendChild(dialog);
  
  // 将对话框添加到panel内而非shadow root
  panel.appendChild(overlay);
}

bootstrap();
