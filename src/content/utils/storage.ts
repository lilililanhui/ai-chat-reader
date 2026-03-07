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

/** 检查 AI 模型配置是否完整（API 端点、API Key、模型名称三项都必须填写） */
export function hasLLMConfigured(config: AppConfig): boolean {
  return !!(config.llm.apiEndpoint && config.llm.apiKey && config.llm.modelName);
}
