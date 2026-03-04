import { getActiveStrategy } from "./strategies/index.js";
import { createUI } from "./ui/createUI.js";
import { extractPreview, flashTarget } from "./utils/dom.js";
import { debounce } from "./utils/debounce.js";

function bootstrap() {
  const strategy = getActiveStrategy();
  if (!strategy) {
    return;
  }

  const state: {
    isOpen: boolean;
    messages: Array<{ id: string; text: string; node: HTMLElement }>;
  } = {
    isOpen: false,
    messages: [],
  };

  const ui = createUI();
  const { container, floatingButton, panel, list, statusText, closeButton } = ui;

  document.documentElement.appendChild(container);

  floatingButton.addEventListener("click", () => {
    state.isOpen = !state.isOpen;
    panel.style.transform = state.isOpen ? "translateX(0)" : "translateX(100%)";
  });

  closeButton.addEventListener("click", () => {
    state.isOpen = false;
    panel.style.transform = "translateX(100%)";
  });

  const scheduleRefresh = debounce(refreshMessages, 300);

  const observer = new MutationObserver(() => {
    scheduleRefresh();
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

    renderList();
  }

  function renderList() {
    list.innerHTML = "";
    if (state.messages.length === 0) {
      statusText.textContent = "暂未识别到用户提问内容。";
      return;
    }

    statusText.textContent = `共 ${state.messages.length} 条用户对话`;

    for (const message of state.messages) {
      const item = document.createElement("button");
      item.className = "item";
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

bootstrap();
