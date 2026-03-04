import qianwenStrategy from "./qianwen.js";
import doubaoStrategy from "./doubao.js";
import type { Strategy } from "./types.js";

const STRATEGIES: Strategy[] = [qianwenStrategy, doubaoStrategy];

export function getActiveStrategy() {
  return STRATEGIES.find((item) => item.match());
}

export { STRATEGIES };
