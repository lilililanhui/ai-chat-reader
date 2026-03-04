import type { Strategy } from "./types.js";

const doubaoStrategy: Strategy = {
  name: "doubao",
  match: () => location.origin.startsWith("https://www.douban.com"),
  getUserMessageElements: () => [],
};

export default doubaoStrategy;
