# Lightrans

一个轻量级的浏览器 AI 翻译扩展，基于 EdgeTranslate 开发，为 Chrome 和 Firefox 浏览器提供无缝的翻译服务，由[硅基流动](https://siliconflow.cn/)提供 api 支持。

Lightrans 网页版已上线，项目地址：[Lightrans_web](https://github.com/W4J1e/lightran_web) ,在线[demo](https://trans.hin.cool/)。

## 功能特性

- **跨浏览器支持**：支持 Chrome 和 Firefox
- **AI 驱动翻译**：使用轻量的 AI 模型提供准确的翻译
- **上下文菜单集成**：易于使用的上下文菜单，方便快速翻译
- **整页翻译**：支持完整的页面翻译
- **多语言支持**：英语、中文（简体）、中文（繁体）、日语
- **PDF 翻译**：支持 PDF 文件的翻译

## 安装说明

### Chrome
1. 从构建输出中下载 Chrome 扩展包
2. 打开 Chrome 浏览器，导航到 `chrome://extensions/`
3. 启用右上角的 "开发者模式"
4. 点击 "加载已解压的扩展程序"，选择 Chrome 构建文件夹
5. 扩展将成功加载

### Firefox
1. 下载 Firefox 扩展包
2. 打开 Firefox 浏览器，导航到 `about:debugging#/runtime/this-firefox`
3. 点击 "临时载入附加组件"，选择 Firefox 构建文件夹
4. 扩展将成功加载

## 开发指南

### 安装依赖
```bash
# 安装依赖
npm install

# 构建项目
npm run build

# 开发模式
npm run dev
```

## 鸣谢

本项目是 [EdgeTranslate](https://github.com/EdgeTranslate/EdgeTranslate) 的分支和修改版本，扩展了其功能并提高了性能。

感谢[硅基流动](https://siliconflow.cn/)提供 api 支持，本项目的基础功能才能得以实现。

## 许可证

MIT License
