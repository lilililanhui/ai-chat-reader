AI Chat Reader 是一个快速查看 AI 会话的 Chrome 浏览器插件。

## 功能简介
- **悬浮球**：在页面右下角显示悬浮球，点击后从右侧拉起侧边栏
- **对话速览**：侧边栏展示用户对话内容的预览（单行省略）
- **快速跳转**：点击条目可滚动到对应对话位置并高亮
- **多站点策略**：不同 AI 站点使用独立策略解析用户对话

## 技术栈
- **构建工具**：Vite + CRXJS
- **语言**：TypeScript
- **浏览器**：Chrome Extension MV3

## 目录结构
```
.
├── src
│   └── content
│       ├── index.ts
│       ├── strategies
│       │   ├── index.ts
│       │   ├── qianwen.ts
│       │   ├── doubao.ts
│       │   └── types.ts
│       ├── ui
│       │   └── createUI.ts
│       └── utils
│           ├── debounce.ts
│           └── dom.ts
├── manifest.json
├── package.json
├── tsconfig.json
└── vite.config.js
```

## 开发与构建
1. 安装依赖：
   - **命令**：`npm install`
2. 本地开发：
   - **命令**：`npm run dev`
   - **说明**：构建产物会输出到 `dist`，在 Chrome 扩展中加载 `dist` 目录即可调试
3. 生产构建：
   - **命令**：`npm run build`
   - **说明**：构建产物输出到 `dist`

## Chrome 加载扩展
1. 打开 `chrome://extensions/`
2. 打开「开发者模式」
3. 点击「加载已解压的扩展程序」，选择 `dist` 目录

## 后续计划
- 扩展更多站点策略
