# Lightrans Direct

一个以“**直连 SiliconFlow、无开发者中继、API Key 不同步**”为核心原则的 Lightrans 分支。

本项目保留 Lightrans / EdgeTranslate 已经成熟的划词翻译、弹窗翻译、整页翻译、PDF 等交互与页面处理能力，主要重做联网、密钥边界与可选的固定术语覆盖。

## 数据流与隐私

翻译请求直接发送到 SiliconFlow：

- `https://api.siliconflow.cn/v1/chat/completions`

本分支不使用 Lightrans 原有的 `trans.hin.cool` 开发者中继，也不内置共享 Relay Token；Gemini 已从产品路径移除。

API Key 保存在 `chrome.storage.local` 的扩展本地存储中，不写入 `chrome.storage.sync`，因此不会通过 Chrome/Firefox 的扩展设置同步机制同步到其他设备。请注意：浏览器本地扩展存储不是操作系统密钥链，仍应使用专门的、权限与额度尽量受限的 API Key。

官方参考：

- SiliconFlow Chat Completions: https://docs.siliconflow.cn/en/api-reference/chat-completions/chat-completions

## 默认配置

- Provider：SiliconFlow
- 模型：`THUDM/GLM-4-9B-0414`
- 目标语言：沿用浏览器 / 扩展原有语言设置
- 页面翻译：仅译文
- 自动术语注释：无
- 固定术语表：开启，但默认内容为空

SiliconFlow 内置 `THUDM/GLM-4-9B-0414`、`tencent/Hunyuan-MT-7B`、`Qwen/Qwen3.5-4B` 三个当前可选模型。模型免费状态由 Provider 决定，未来可能变化。

也可以启用“自定义模型”，手动填写 SiliconFlow 支持的模型 ID。

## 翻译与固定术语

默认翻译路径保持简单：所有源语言文本都按普通翻译处理，不要求模型保留英文术语，也不要求模型生成 `English（中文解释）` 形式的自动注释。系统提示明确禁止新增原文不存在的双语注释、定义、说明或括号解释，从而降低重复解释、嵌套括号和语序污染。

用户仍可通过固定术语表显式覆盖任意文本的最终显示形式，每行格式：

```text
原词 = 最终显示文本
```

例如：

```text
API = 应用程序编程接口
```

固定术语使用占位符保护，在模型翻译之后确定性恢复，不依赖模型是否记住提示词。对受保护占位符还会清理模型误加的紧邻括号说明，避免类似重复嵌套结果。

## 功能

- Chrome / Firefox
- 划词翻译与双击翻译
- 弹窗翻译
- 整页翻译
- 原文 / 译文 / 双语对照显示
- PDF 翻译
- 页面与域名黑名单
- SiliconFlow 直连
- 模型可在弹窗直接切换
- API Key 本机保存
- 可选用户固定术语表

## 安装开发版

### Chrome

1. 构建 Chrome 版本。
2. 打开 `chrome://extensions/`。
3. 开启“开发者模式”。
4. 点击“加载已解压的扩展程序”。
5. 选择构建生成的 Chrome 扩展目录。
6. 打开扩展设置并填写 SiliconFlow API Key。

### Firefox

1. 构建 Firefox 版本。
2. 打开 `about:debugging#/runtime/this-firefox`。
3. 点击“临时载入附加组件”。
4. 选择 Firefox 构建目录中的 manifest。
5. 打开扩展设置并填写 SiliconFlow API Key。

## 开发

仓库由两个主要 package 组成：

- `packages/translators`：翻译请求与固定术语处理层
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
