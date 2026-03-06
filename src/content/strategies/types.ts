export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatTurn = {
  index: number;
  user: ChatMessage;
  assistant: ChatMessage | null;
};

export type SessionInfo = {
  sessionId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
};

export type LoadingStatus = {
  state: "idle" | "loading" | "done";
  loaded: number;
  hasMore: boolean;
};

export type Strategy = {
  name: string;
  match: () => boolean;
  getUserMessageElements: () => HTMLElement[];

  init: () => void;
  getChatTurns: () => ChatTurn[];
  getSessionInfo: () => SessionInfo | null;
  getLoadingStatus: () => LoadingStatus;
  onDataUpdate: (callback: (turns: ChatTurn[]) => void) => void;
  onLoadingStatusChange?: (callback: (status: LoadingStatus) => void) => void;
  onSessionChange?: (callback: (sessionId: string) => void) => void;
  /** 手动刷新：清除缓存并重新请求接口数据 */
  refresh?: () => void;
};
