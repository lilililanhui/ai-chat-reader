import type { Strategy } from "./types.js";

const qianwenStrategy: Strategy = {
  name: "qianwen",
  match: () => location.origin.startsWith("https://www.qianwen.com"),
  getUserMessageElements: () => {
    const nodes = Array.from(document.querySelectorAll("[class*='questionItem-']"));
    return nodes.filter((node) =>
      Array.from(node.classList).some((cls) => cls.startsWith("questionItem-"))
    );
  },
};

export default qianwenStrategy;
