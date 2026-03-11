type AboutOptions = {
  shadow: ShadowRoot;
  panel: HTMLDivElement;
  list: HTMLDivElement;
  onClose: () => void;
};

export function openAbout(options: AboutOptions) {
  const { shadow, panel, list, onClose } = options;

  list.style.display = "none";

  // Remove existing about if any
  const existing = shadow.querySelector(".acr-about-wrap");
  if (existing) existing.remove();

  // Inject back button into header
  const header = panel.querySelector(".acr-header") as HTMLDivElement;
  const backBtn = document.createElement("button");
  backBtn.className = "acr-icon-btn acr-back-btn";
  backBtn.type = "button";
  backBtn.title = "返回";
  backBtn.setAttribute("data-tooltip", "返回");
  backBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>`;
  header.insertBefore(backBtn, header.firstChild);

  const wrap = document.createElement("div");
  wrap.className = "acr-about-wrap";

  // === Header: Logo + Name ===
  const aboutHeader = document.createElement("div");
  aboutHeader.className = "acr-about-header";

  const logoWrap = document.createElement("div");
  logoWrap.className = "acr-about-logo";
  const logoImg = document.createElement("img");
  logoImg.src = chrome.runtime.getURL("assets/logo-128.png");
  logoImg.alt = "AI Chat Reader";
  logoWrap.appendChild(logoImg);

  const nameEl = document.createElement("div");
  nameEl.className = "acr-about-name";
  nameEl.textContent = "AI Chat Reader";

  const versionEl = document.createElement("div");
  versionEl.className = "acr-about-version";
  versionEl.textContent = "v0.1.0";

  aboutHeader.appendChild(logoWrap);
  aboutHeader.appendChild(nameEl);
  aboutHeader.appendChild(versionEl);

  // === Introduction Section ===
  const introSection = document.createElement("div");
  introSection.className = "acr-about-section";

  const introTitle = document.createElement("div");
  introTitle.className = "acr-about-section-title";
  introTitle.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> 简介`;

  const introText = document.createElement("div");
  introText.className = "acr-about-text";
  introText.innerHTML = `
    <p>AI Chat Reader 是一款浏览器扩展，帮助你快速浏览、定位和导出 AI 对话内容。支持将对话一键导出为结构化的 Markdown 文件，方便归档与分享。</p>
    <p style="margin-top:8px;">目前已支持 <strong>通义千问</strong> 对话平台，后续将陆续适配 <strong>豆包</strong>、<strong>Gemini</strong>、<strong>ChatGPT</strong> 等主流 AI 对话平台，敬请期待。</p>
  `;

  introSection.appendChild(introTitle);
  introSection.appendChild(introText);

  // === Developer Section ===
  const devSection = document.createElement("div");
  devSection.className = "acr-about-section";

  const devTitle = document.createElement("div");
  devTitle.className = "acr-about-section-title";
  devTitle.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> 开发者信息`;

  const devContent = document.createElement("div");
  devContent.style.cssText = "display:flex;flex-direction:column;gap:2px;";

  devContent.appendChild(createInfoRow("开发者", "lilililanhui"));
  devContent.appendChild(
    createInfoRowWithLink(
      "GitHub",
      "lilililanhui",
      "https://github.com/lilililanhui"
    )
  );
  devContent.appendChild(
    createInfoRowWithLink(
      "小红书",
      "lilililanhui",
      "https://www.xiaohongshu.com/user/profile/5c1fb64f000000000503f1af"
    )
  );

  // 微信公众号行（与其他行统一风格，icon hover 显示二维码）
  const wechatRow = document.createElement("div");
  wechatRow.className = "acr-about-row";

  const wechatLabel = document.createElement("span");
  wechatLabel.className = "acr-about-row-label";
  wechatLabel.textContent = "微信公众号";

  const wechatValue = document.createElement("span");
  wechatValue.textContent = "ISTJ优化指南";

  const qrTrigger = document.createElement("span");
  qrTrigger.className = "acr-about-qr-trigger";
  qrTrigger.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="8" height="8" rx="1"/><rect x="14" y="2" width="8" height="8" rx="1"/><rect x="2" y="14" width="8" height="8" rx="1"/><rect x="14" y="14" width="3" height="3"/><rect x="19" y="14" width="3" height="3"/><rect x="14" y="19" width="3" height="3"/><rect x="19" y="19" width="3" height="3"/><rect x="6" y="6" width="0.01" height="0.01" stroke-width="3"/><rect x="18" y="6" width="0.01" height="0.01" stroke-width="3"/><rect x="6" y="18" width="0.01" height="0.01" stroke-width="3"/></svg>`;

  const qrPopover = document.createElement("div");
  qrPopover.className = "acr-about-qr-popover";

  const qrImg = document.createElement("img");
  qrImg.src = chrome.runtime.getURL("assets/qrcode.jpg");
  qrImg.alt = "微信公众号：ISTJ优化指南";

  const qrHint = document.createElement("div");
  qrHint.className = "acr-about-qr-hint";
  qrHint.textContent = "扫码关注公众号";

  qrPopover.appendChild(qrImg);
  qrPopover.appendChild(qrHint);
  qrTrigger.appendChild(qrPopover);

  wechatRow.appendChild(wechatLabel);
  wechatRow.appendChild(wechatValue);
  wechatRow.appendChild(qrTrigger);

  devContent.appendChild(wechatRow);

  devSection.appendChild(devTitle);
  devSection.appendChild(devContent);

  // === Assemble ===
  wrap.appendChild(aboutHeader);
  wrap.appendChild(introSection);
  wrap.appendChild(devSection);

  panel.insertBefore(wrap, list);

  backBtn.addEventListener("click", () => {
    close();
  });

  function close() {
    wrap.remove();
    backBtn.remove();
    list.style.display = "";
    onClose();
  }
}

function createInfoRow(label: string, value: string): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "acr-about-row";

  const lbl = document.createElement("span");
  lbl.className = "acr-about-row-label";
  lbl.textContent = label;

  const val = document.createElement("span");
  val.textContent = value;

  row.appendChild(lbl);
  row.appendChild(val);
  return row;
}

function createInfoRowWithLink(label: string, text: string, href: string): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "acr-about-row";

  const lbl = document.createElement("span");
  lbl.className = "acr-about-row-label";
  lbl.textContent = label;

  const link = document.createElement("a");
  link.className = "acr-about-link";
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = text;

  row.appendChild(lbl);
  row.appendChild(link);
  return row;
}
