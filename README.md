# Lightrans Direct

一个以“**直连 SiliconFlow、无开发者中继、API Key 不同步**”为核心原则的 Lightrans 分支。

本项目保留 Lightrans / EdgeTranslate 已经成熟的划词翻译、弹窗翻译、整页翻译、PDF 等交互与页面处理能力，主要重做联网与密钥边界，并增加可控的术语注释层。

## 数据流与隐私

翻译请求只发送到 SiliconFlow：

- `https://api.siliconflow.cn/v1/chat/completions`

本分支不使用 Lightrans 原有的 `trans.hin.cool` 开发者中继，也不内置共享 Relay Token。Gemini 已从正常产品路径移除。

API Key 保存在 `chrome.storage.local` 的扩展本地存储中，不写入 `chrome.storage.sync`，因此不会通过 Chrome/Firefox 的扩展设置同步机制同步到其他设备。请注意：浏览器本地扩展存储不是操作系统密钥链，仍应使用专门的、权限与额度尽量受限的 API Key。

## 默认配置

- Provider：SiliconFlow
- 模型：`THUDM/GLM-4-9B-0414`
- 目标语言：沿用浏览器 / 扩展原有语言设置
- 页面翻译：仅译文
- 固定术语表：启用
- 自动术语注释：启用

内置模型：

- `THUDM/GLM-4-9B-0414`
- `tencent/Hunyuan-MT-7B`
- `Qwen/Qwen3.5-4B`

免费状态由 SiliconFlow 决定，未来可能变化。也可以启用“自定义模型”，手动填写 SiliconFlow 支持的模型 ID。

## 术语注释

Lightrans Direct 提供两层术语处理。

### 固定术语表

设置页可按每行一条的格式写规则：

```text
Obsidian = Obsidian（笔记与知识管理软件）
Docker = Docker（容器化平台）
MCP = MCP（模型上下文协议）
```

固定术语不依赖模型“记住提示词”。扩展会先把原词替换成受保护的占位符，模型翻译完成后再机械还原。因此同一术语在一页中出现多少次，就会按配置格式显示多少次。

匹配目前采用原词精确匹配。固定术语优先级高于自动注释。

### 自动术语注释

启用后，当目标语言为中文时，模型会尝试对术语表之外的英文软件名、产品名、项目名、技术缩写和专业词添加简短中文说明，例如：

```text
Obsidian（笔记与知识管理软件）
```

如果模型不确定一个专有名词的含义，提示词要求保留原词而不是编造解释。对于必须保持完全一致的术语，仍建议加入固定术语表。

## 功能

- Chrome / Firefox
- 划词翻译与双击翻译
- 弹窗翻译
- 整页翻译
- 原文 / 译文 / 双语对照显示
- PDF 翻译
- 页面与域名黑名单
- SiliconFlow 直连
- 弹窗直接切换模型
- API Key 本机保存
- 固定术语表
- 自动英文术语中文注释

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

- `packages/translators`：SiliconFlow / 翻译请求 / 术语保护层
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

仓库内的 GitHub Actions 会验证隐私边界、translator 构建、Chrome 构建与 Firefox 构建，并生成可下载的构建产物。

## 与上游的关系

本项目 fork 自 [W4J1e/Lightrans](https://github.com/W4J1e/Lightrans)，而 Lightrans 基于 [EdgeTranslate](https://github.com/EdgeTranslate/EdgeTranslate)。

本分支不会删除上游归属与许可证信息；后续同步上游时，优先保留其成熟的网页翻译能力，同时对新增联网行为进行单独审查。

## 许可证

继承代码包含 EdgeTranslate 的 **MIT AND NPL** 许可要求。请同时阅读：

- `LICENSE`
- `LICENSE.MIT`
- `LICENSE.NPL`

仓库内 PDF.js、字体等第三方资源还包含其各自许可证文件。
