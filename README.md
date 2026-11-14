<div align="center">

<img src="public/icon-512.png" width="120" alt="Cetus" />

# Cetus · 鲸屿

**不登录，不注册。填上你自己的 Key，就开始聊。**

一个轻量的 DeepSeek 客户端 —— 没有账号体系，没有中间服务器，没有数据上云。
你的会话留在你自己的浏览器里，你的 Key 也只在你自己的设备上。

</div>

---

## 为什么做这个

DeepSeek 官方网页版很好用，但它是给所有人用的：要登录、数据在云端、历史不能带走、参数不能调。

鲸屿想解决的是另一小撮人的需求 —— **那些想自己管 Key、自己管数据、不想被账号绑住的人**。

所以这里没有：

- ❌ 注册 / 登录 / 手机验证
- ❌ 用户画像 / 埋点 / 统计
- ❌ 中间服务器转发（请求从你的浏览器直接打到 DeepSeek）
- ❌ 云端会话存储

只有：

- ✅ 一个输入框，和它该有的一切

## 功能

| | |
|---|---|
| **对话** | 流式输出、可随时停止、继续生成、编辑提问、重新生成、消息分支切换 |
| **思考** | 深度思考模式（DeepThink），思考过程可折叠展开 |
| **联网** | 智能搜索、链接自动阅读、来源引用标注 |
| **文件** | PDF / Office / 图片上传、粘贴、拖拽 |
| **语音** | 语音输入（带实时频谱）、回答朗读 |
| **渲染** | Markdown、代码高亮、KaTeX 公式、Mermaid 图表 |
| **数据** | 多会话、自动标题、重命名删除、历史 ZIP 导入导出 |
| **界面** | 浅色/深色主题、移动端布局、简体中文/英文 |

## 上手

### 在线使用

打开 [https://xiaogui-666.github.io/cetus/](https://xiaogui-666.github.io/cetus/) ，进入**设置**填入 DeepSeek API Key 即可。

在手机上可以用浏览器菜单里的「添加到主屏幕」，它会以全屏应用的样子运行。

### 本地运行

需要 Node.js 22.12+ 与 pnpm：

```sh
pnpm install
pnpm dev
```

打开 http://localhost:8090 。

### 构建静态产物

```sh
pnpm build
```

产物在 `dist/`，可直接丢到任意静态服务器，也可以双击 `dist/index.html` 离线用（需浏览器允许 `file://` 页面访问存储与跨域请求）。

## 部署

推送到 `main` 分支后，GitHub Actions 会自动执行类型检查、Lint、构建，并发布到 GitHub Pages（见 `.github/workflows/pages.yml`）。无需本地环境。

## 数据与隐私

- **API Key 与设置**：保存在浏览器 `localStorage`
- **会话与附件原件**：保存在浏览器 `IndexedDB`
- **数据隔离**：按浏览器用户配置与站点源（origin）隔离，换域名或换浏览器就是一份新的空数据
- **网络行为**：只在发送对话、上传附件、使用语音时，把相应内容提交给你配置的 API 服务；除此之外没有任何外部请求
- **导入导出**：ZIP 格式，包含会话与本地图片原件，**不包含 API Key**

> 清空浏览器数据 = 数据没了。重要会话请定期导出。

## 技术栈

React 18 · TypeScript · rspack · zustand · IndexedDB (idb) · 纯 CSS Modules + CSS 变量

协议层基于 **Anthropic 兼容的 Messages / Files API** 与 DeepSeek 的 ASR / TTS 接口通信。默认模型 `deepseek-flash`。

## 路线

- [x] Web 版上线（PWA，可添加到主屏幕）
- [ ] 桌面版（Windows）：全局快捷键唤起、托盘常驻、划词提问
- [ ] 提示词库与快捷指令
- [ ] 多 Key / 多配置切换
- [ ] Android 客户端

## 致谢

界面与协议实现基于 [DeepSeek 官方 chat-demo](https://github.com/deepseek-ai/chat-demo)（MIT License），在此基础上的品牌化与后续改造由本项目维护。

图标与配色为独立设计，与 DeepSeek 官方无隶属关系。本项目是非官方第三方客户端。

## License

[MIT](LICENSE)
