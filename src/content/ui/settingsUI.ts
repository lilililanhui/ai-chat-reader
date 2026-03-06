import type { AppConfig } from "../utils/storage.js";
import { loadConfig, saveConfig } from "../utils/storage.js";

type SettingsOptions = {
  shadow: ShadowRoot;
  panel: HTMLDivElement;
  list: HTMLDivElement;
  onClose: () => void;
};

export async function openSettings(options: SettingsOptions) {
  const { shadow, panel, list, onClose } = options;

  const config = await loadConfig();

  list.style.display = "none";

  // Remove existing settings if any
  const existing = shadow.querySelector(".acr-settings-wrap");
  if (existing) existing.remove();
  const existingFooter = shadow.querySelector(".acr-footer");
  if (existingFooter) existingFooter.remove();

  const wrap = document.createElement("div");
  wrap.className = "acr-settings-wrap";

  // === AI Model Config Section ===
  const aiSection = createSection("AI 模型配置");

  const endpointRow = createInputRow("API 端点", "text", config.llm.apiEndpoint, "https://dashscope.aliyuncs.com/compatible-mode/v1");
  const keyRow = createPasswordRow("API Key", config.llm.apiKey, "sk-...");
  const modelRow = createInputRow("模型名称", "text", config.llm.modelName, "qwen-plus");

  aiSection.appendChild(endpointRow.row);
  aiSection.appendChild(keyRow.row);
  aiSection.appendChild(modelRow.row);

  // === Export Meta Config Section ===
  const exportSection = createSection("导出信息配置");

  const sourceCheck = createCheckboxRow("显示来源", config.exportMeta.showSource);
  const timeCheck = createCheckboxRow("显示导出时间", config.exportMeta.showExportTime);
  const turnCheck = createCheckboxRow("显示对话轮次", config.exportMeta.showTurnCount);

  exportSection.appendChild(sourceCheck.row);
  exportSection.appendChild(timeCheck.row);
  exportSection.appendChild(turnCheck.row);

  wrap.appendChild(aiSection);
  wrap.appendChild(exportSection);

  panel.insertBefore(wrap, list);

  // Footer with back button only
  const footer = document.createElement("div");
  footer.className = "acr-footer";

  const backBtn = document.createElement("button");
  backBtn.className = "acr-btn-secondary";
  backBtn.type = "button";
  backBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg> 返回`;

  footer.appendChild(backBtn);
  panel.appendChild(footer);

  // Auto-save on any input change
  const autoSave = async () => {
    const newConfig: AppConfig = {
      llm: {
        apiEndpoint: endpointRow.input.value.trim(),
        apiKey: keyRow.input.value.trim(),
        modelName: modelRow.input.value.trim(),
      },
      exportMeta: {
        showSource: sourceCheck.checkbox.checked,
        showExportTime: timeCheck.checkbox.checked,
        showTurnCount: turnCheck.checkbox.checked,
      },
    };
    await saveConfig(newConfig);
  };

  // Attach auto-save listeners
  for (const input of [endpointRow.input, keyRow.input, modelRow.input]) {
    input.addEventListener("change", autoSave);
  }
  for (const cb of [sourceCheck.checkbox, timeCheck.checkbox, turnCheck.checkbox]) {
    cb.addEventListener("change", autoSave);
  }

  backBtn.addEventListener("click", () => {
    autoSave();
    close();
  });

  function close() {
    wrap.remove();
    footer.remove();
    list.style.display = "";
    onClose();
  }
}

function createSection(title: string): HTMLDivElement {
  const section = document.createElement("div");
  section.className = "acr-settings-section";

  const h = document.createElement("div");
  h.className = "acr-settings-section-title";
  h.textContent = title;
  section.appendChild(h);

  return section;
}

function createInputRow(label: string, type: string, value: string, placeholder: string) {
  const row = document.createElement("div");
  row.className = "acr-settings-row";

  const lbl = document.createElement("label");
  lbl.className = "acr-settings-label";
  lbl.textContent = label;

  const input = document.createElement("input");
  input.className = "acr-settings-input";
  input.type = type;
  input.value = value;
  input.placeholder = placeholder;

  row.appendChild(lbl);
  row.appendChild(input);

  return { row, input };
}

function createPasswordRow(label: string, value: string, placeholder: string) {
  const row = document.createElement("div");
  row.className = "acr-settings-row";

  const lbl = document.createElement("label");
  lbl.className = "acr-settings-label";
  lbl.textContent = label;

  const inputWrap = document.createElement("div");
  inputWrap.className = "acr-settings-password-wrap";

  const input = document.createElement("input");
  input.className = "acr-settings-input";
  input.type = "password";
  input.value = value;
  input.placeholder = placeholder;

  const toggleBtn = document.createElement("button");
  toggleBtn.className = "acr-settings-eye-btn";
  toggleBtn.type = "button";
  toggleBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;

  toggleBtn.addEventListener("click", () => {
    input.type = input.type === "password" ? "text" : "password";
  });

  inputWrap.appendChild(input);
  inputWrap.appendChild(toggleBtn);
  row.appendChild(lbl);
  row.appendChild(inputWrap);

  return { row, input };
}

function createCheckboxRow(label: string, checked: boolean) {
  const row = document.createElement("div");
  row.className = "acr-settings-checkbox-row";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = checked;
  checkbox.className = "acr-settings-checkbox";

  const lbl = document.createElement("label");
  lbl.className = "acr-settings-checkbox-label";
  lbl.textContent = label;
  lbl.addEventListener("click", () => {
    checkbox.checked = !checkbox.checked;
  });

  row.appendChild(checkbox);
  row.appendChild(lbl);

  return { row, checkbox };
}
