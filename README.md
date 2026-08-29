# Lightrans Direct

一个以“**直连 Provider、无开发者中继、API Key 不同步**”为核心原则的 Lightrans 分支。

本项目保留 Lightrans / EdgeTranslate 已经成熟的划词翻译、弹窗翻译、整页翻译、PDF 等交互与页面处理能力，主要重做联网与密钥边界。

## 数据流与隐私

翻译请求只发送到你在设置中选择的 Provider：

- **SiliconFlow**：`https://api.siliconflow.cn/v1/chat/completions`
- **Gemini API**：`https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`

本分支不使用 Lightrans 原有的 `trans.hin.cool` 开发者中继，也不内置共享 Relay Token。

API Key 保存在 `chrome.storage.local` 的扩展本地存储中，不写入 `chrome.storage.sync`，因此不会通过 Chrome/Firefox 的扩展设置同步机制同步到其他设备。请注意：浏览器本地扩展存储不是操作系统密钥链，仍应使用专门的、权限与额度尽量受限的 API Key。

### Gemini 免费层提醒

Google 当前说明 Gemini Developer API 的免费层内容可能用于改进其产品；付费层则说明内容不用于改进产品。涉及敏感或私密网页时，请自行选择合适的 Provider / 计费层。

官方参考：

- Gemini OpenAI compatibility: https://ai.google.dev/gemini-api/docs/openai
- Gemini API pricing / data-use notes: https://ai.google.dev/gemini-api/docs/pricing
- SiliconFlow Chat Completions: https://docs.siliconflow.cn/en/api-reference/chat-completions/chat-completions

## 默认配置

- Provider：SiliconFlow
- 模型：`tencent/Hunyuan-MT-7B`
- 目标语言：沿用浏览器 / 扩展原有语言设置
- 页面翻译：仅译文

Gemini 默认模型为 `gemini-3.7-flash`。设置中还提供 `gemini-3.5-flash-lite`（官方明确针对高吞吐、翻译和简单数据处理优化）以及 `gemini-3.5-flash`；这些模型当前的 Standard Free Tier 都提供免费输入/输出额度。

也可以启用“自定义模型”，手动填写对应 Provider 支持的模型 ID。

## 功能

- Chrome / Firefox
- 划词翻译与双击翻译
- 弹窗翻译
- 整页翻译
- 原文 / 译文 / 双语对照显示
- PDF 翻译
- 页面与域名黑名单
- SiliconFlow / Gemini 直连
- Provider API Key 本机保存

## 安装开发版

### Chrome

1. 构建 Chrome 版本。
2. 打开 `chrome://extensions/`。
3. 开启“开发者模式”。
4. 点击“加载已解压的扩展程序”。
5. 选择构建生成的 Chrome 扩展目录。
6. 打开扩展设置，选择 Provider 并填写对应 API Key。

### Firefox

1. 构建 Firefox 版本。
2. 打开 `about:debugging#/runtime/this-firefox`。
3. 点击“临时载入附加组件”。
4. 选择 Firefox 构建目录中的 manifest。
5. 打开扩展设置并填写 Provider API Key。

## 开发

仓库由两个主要 package 组成：

- `packages/translators`：Provider / 翻译请求层
- `packages/lightrans`：浏览器扩展 UI、后台逻辑、页面注入与整页翻译

```bash
cd packages/translators
npm install
npm run build

cd ../lightrans
npm install
npm run build:chrome
npm run build:firefox
```

仓库内的 GitHub Actions 会对 Chrome 与 Firefox 构建进行验证。

## 与上游的关系

本项目 fork 自 [W4J1e/Lightrans](https://github.com/W4J1e/Lightrans)，而 Lightrans 基于 [EdgeTranslate](https://github.com/EdgeTranslate/EdgeTranslate)。

本分支不会删除上游归属与许可证信息；后续同步上游时，优先保留其成熟的网页翻译能力，同时对新增联网行为进行单独审查。

## 许可证

继承代码包含 EdgeTranslate 的 **MIT AND NPL** 许可要求。请同时阅读：

- `LICENSE`
- `LICENSE.MIT`
- `LICENSE.NPL`

仓库内 PDF.js、字体等第三方资源还包含其各自许可证文件。
