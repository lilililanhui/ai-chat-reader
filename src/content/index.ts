import { getActiveStrategy } from "./strategies/index.js";
import type { ChatTurn } from "./strategies/types.js";
import { createUI } from "./ui/createUI.js";
import { enterExportMode } from "./ui/exportMode.js";
import { openSettings } from "./ui/settingsUI.js";
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
    messages: Array<{ id: string; text: string; node: HTMLElement }>;
    chatTurns: ChatTurn[];
  } = {
    isOpen: false,
    isExportMode: false,
    isSettings: false,
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
  } = ui;

  document.documentElement.appendChild(container);

  strategy.init();

  strategy.onDataUpdate((turns) => {
    state.chatTurns = turns;
    if (!state.isExportMode && !state.isSettings) {
      renderTurnsList();
    }
  });

  // 监听加载状态变化
  if (strategy.onLoadingStatusChange) {
    strategy.onLoadingStatusChange((loadStatus) => {
      if (state.isExportMode || state.isSettings) return;
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
      if (state.isExportMode || state.isSettings) {
        showSessionSwitchDialog(shadow, () => {
          // 确认：退回列表页
          exitCurrentMode();
          renderTurnsList();
        });
      }
    });
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
    if (state.chatTurns.length === 0) {
      alert("暂无对话数据，请等待页面加载对话后重试");
      return;
    }
    // 如果在设置页，先关闭
    if (state.isSettings) {
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
    // 如果在导出模式，先退出
    if (state.isExportMode) {
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

  /** 退出当前所有子模式（导出 / 设置），恢复列表 */
  function exitCurrentMode() {
    state.isExportMode = false;
    state.isSettings = false;
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
    list.style.display = "";
  }

  const scheduleRefresh = debounce(refreshMessages, 300);

  const observer = new MutationObserver(() => {
    if (!state.isExportMode && !state.isSettings) {
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

    if (!state.isExportMode && !state.isSettings) {
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

/** 显示会话切换确认对话框 */
function showSessionSwitchDialog(shadow: ShadowRoot, onConfirm: () => void) {
  // 防重复
  const existing = shadow.querySelector(".acr-dialog-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.className = "acr-dialog-overlay";

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
  cancelBtn.addEventListener("click", () => overlay.remove());

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
  shadow.appendChild(overlay);
}

bootstrap();
