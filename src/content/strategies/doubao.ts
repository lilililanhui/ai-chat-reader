import type { Strategy } from "./types.js";

const doubaoStrategy: Strategy = {
  name: "doubao",
  match: () => location.origin.startsWith("https://www.douban.com"),
  getUserMessageElements: () => [],

  init: () => {},
  getChatTurns: () => [],
  getSessionInfo: () => null,
  getLoadingStatus: () => ({ state: "idle" as const, loaded: 0, hasMore: false }),
  onDataUpdate: () => {},
};

export default doubaoStrategy;
