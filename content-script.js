(() => {
  const STRATEGIES = [
    {
      name: "qianwen",
      match: () => location.origin.startsWith("https://www.qianwen.com"),
      getUserMessageElements: () => {
        const nodes = Array.from(document.querySelectorAll("[class*='questionItem-']"));
        return nodes.filter((node) =>
          Array.from(node.classList).some((cls) => cls.startsWith("questionItem-"))
        );
      },
    },
    {
      name: "doubao",
      match: () => location.origin.startsWith("https://www.douban.com"),
      getUserMessageElements: () => [],
    },
  ];

  const strategy = STRATEGIES.find((item) => item.match());
  if (!strategy) return;

  const state = {
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

  const observer = new MutationObserver(() => {
    scheduleRefresh();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  const scheduleRefresh = debounce(refreshMessages, 300);
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

  function extractPreview(node) {
    const text = node.innerText
      .replace(/\s+/g, " ")
      .trim();
    if (!text) return "";
    return text.length > 80 ? `${text.slice(0, 80)}…` : text;
  }

  function flashTarget(node) {
    const original = node.style.boxShadow;
    node.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.6)";
    setTimeout(() => {
      node.style.boxShadow = original;
    }, 1200);
  }

  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function createUI() {
    const container = document.createElement("div");
    container.id = "ai-chat-reader-root";
    container.style.position = "fixed";
    container.style.right = "0";
    container.style.bottom = "0";
    container.style.zIndex = "2147483647";

    const shadow = container.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
      :host { all: initial; }
      .floating-button {
        position: fixed;
        right: 24px;
        bottom: 24px;
        width: 52px;
        height: 52px;
        border-radius: 50%;
        background: #2563eb;
        color: #fff;
        border: none;
        box-shadow: 0 10px 24px rgba(37, 99, 235, 0.35);
        cursor: pointer;
        font-size: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s ease;
      }
      .floating-button:hover { transform: scale(1.05); }
      .panel {
        position: fixed;
        right: 0;
        top: 0;
        height: 100vh;
        width: 320px;
        background: #ffffff;
        border-left: 1px solid #e5e7eb;
        box-shadow: -10px 0 24px rgba(15, 23, 42, 0.08);
        transform: translateX(100%);
        transition: transform 0.25s ease;
        display: flex;
        flex-direction: column;
        font-family: "PingFang SC", "Microsoft Yahei", sans-serif;
      }
      .header {
        padding: 16px 18px 12px;
        border-bottom: 1px solid #e5e7eb;
        position: relative;
      }
      .close-button {
        position: absolute;
        right: 12px;
        top: 12px;
        width: 28px;
        height: 28px;
        border-radius: 8px;
        border: none;
        background: #f1f5f9;
        color: #0f172a;
        cursor: pointer;
        font-size: 16px;
        line-height: 28px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s ease;
      }
      .close-button:hover {
        background: #e2e8f0;
      }
      .title {
        font-size: 16px;
        font-weight: 600;
        color: #0f172a;
      }
      .subtitle {
        margin-top: 6px;
        font-size: 12px;
        color: #64748b;
      }
      .list {
        padding: 12px 12px 20px;
        overflow-y: auto;
        flex: 1;
      }
      .item {
        width: 100%;
        padding: 10px 12px;
        margin-bottom: 8px;
        border-radius: 10px;
        background: #f8fafc;
        border: 1px solid transparent;
        text-align: left;
        font-size: 13px;
        line-height: 1.4;
        color: #1e293b;
        cursor: pointer;
        transition: border-color 0.2s ease, background 0.2s ease;
      }
      .item:hover {
        background: #eef2ff;
        border-color: #c7d2fe;
      }
    `;

    const floatingButton = document.createElement("button");
    floatingButton.className = "floating-button";
    floatingButton.type = "button";
    floatingButton.title = "打开 AI 会话侧边栏";
    floatingButton.textContent = "AI";

    const panel = document.createElement("div");
    panel.className = "panel";

    const header = document.createElement("div");
    header.className = "header";

    const title = document.createElement("div");
    title.className = "title";
    title.textContent = "会话速览";

    const subtitle = document.createElement("div");
    subtitle.className = "subtitle";
    subtitle.textContent = "正在识别用户提问";

    const closeButton = document.createElement("button");
    closeButton.className = "close-button";
    closeButton.type = "button";
    closeButton.title = "关闭侧边栏";
    closeButton.textContent = "×";

    header.appendChild(title);
    header.appendChild(subtitle);
    header.appendChild(closeButton);

    const list = document.createElement("div");
    list.className = "list";

    panel.appendChild(header);
    panel.appendChild(list);

    shadow.appendChild(style);
    shadow.appendChild(floatingButton);
    shadow.appendChild(panel);

    return {
      container,
      floatingButton,
      panel,
      list,
      statusText: subtitle,
      closeButton,
    };
  }
})();
