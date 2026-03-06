export type ExportMetaConfig = {
  showSource: boolean;
  showExportTime: boolean;
  showTurnCount: boolean;
};

export type LLMConfig = {
  apiEndpoint: string;
  apiKey: string;
  modelName: string;
};

export type AppConfig = {
  llm: LLMConfig;
  exportMeta: ExportMetaConfig;
};

const DEFAULT_CONFIG: AppConfig = {
  llm: {
    apiEndpoint: "",
    apiKey: "",
    modelName: "",
  },
  exportMeta: {
    showSource: true,
    showExportTime: true,
    showTurnCount: true,
  },
};

export async function loadConfig(): Promise<AppConfig> {
  try {
    const result = await chrome.storage.sync.get("acrConfig");
    if (result.acrConfig) {
      return {
        llm: { ...DEFAULT_CONFIG.llm, ...result.acrConfig.llm },
        exportMeta: { ...DEFAULT_CONFIG.exportMeta, ...result.acrConfig.exportMeta },
      };
    }
  } catch {
    // storage not available, use defaults
  }
  return { ...DEFAULT_CONFIG, llm: { ...DEFAULT_CONFIG.llm }, exportMeta: { ...DEFAULT_CONFIG.exportMeta } };
}

export async function saveConfig(config: AppConfig): Promise<void> {
  try {
    await chrome.storage.sync.set({ acrConfig: config });
  } catch {
    // storage not available
  }
}

export function hasCustomLLM(config: AppConfig): boolean {
  return !!(config.llm.apiEndpoint && config.llm.apiKey);
}

export function isOnQianwen(): boolean {
  return location.origin.startsWith("https://www.qianwen.com");
}

export function hasAnyLLM(config: AppConfig): boolean {
  return isOnQianwen() || hasCustomLLM(config);
}
