# Lightrans

一个轻量级且功能强大的翻译扩展，基于 EdgeTranslate 开发，为 Chrome 和 Firefox 浏览器提供无缝的翻译服务。

Lightrans 网页版已上线，项目地址：[Lightrans_web](https://github.com/W4J1e/lightran_web) ,在线[demo](https://trans.hin.cool/)。

## 界面预览

> 以下为静态示意。GitHub 会渲染 Markdown 中的内联 HTML/CSS（行内 `style`），但会剥离 &lt;style&gt; 块、&lt;script&gt; 与交互动效，因此玻璃质感与交互状态在此以**静态近似**呈现。
>

### 选词翻译

<div style="border:1px solid #e6e9f0;border-radius:14px;overflow:hidden;max-width:720px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,'PingFang SC','Microsoft YaHei',sans-serif;color:#1f2430;background:#fbfcfe;">
  <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:#f1f3f8;border-bottom:1px solid #e6e9f0;">
    <span style="width:11px;height:11px;border-radius:50%;background:#ff5f57;display:inline-block;"></span>
    <span style="width:11px;height:11px;border-radius:50%;background:#febc2e;display:inline-block;"></span>
    <span style="width:11px;height:11px;border-radius:50%;background:#28c840;display:inline-block;"></span>
    <span style="flex:1;margin-left:10px;background:#fff;border:1px solid #e2e6ef;border-radius:8px;padding:5px 10px;font-size:12px;color:#9aa3b2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">https://example.com/docs/getting-started</span>
  </div>
  <div style="display:flex;flex-wrap:wrap;gap:24px;padding:24px;align-items:flex-start;">
    <div style="flex:1;min-width:220px;">
      <h3 style="font-size:18px;margin:0 0 12px;">Getting Started</h3>
      <p style="color:#46506a;font-size:14px;line-height:1.6;margin:0 0 12px;">The <span style="background:rgba(74,140,247,0.18);border-radius:4px;padding:0 3px;">translation engine</span> runs entirely in your browser. Select any text on the page and a lightweight panel appears with the result.</p>
      <p style="color:#46506a;font-size:14px;line-height:1.6;margin:0;">You can pin the panel, switch the underlying model, or open settings — all without leaving the current tab.</p>
    </div>
    <div style="width:300px;max-width:100%;border-radius:14px;background:#ffffff;border:1px solid rgba(0,0,0,0.08);box-shadow:0 8px 24px rgba(31,41,55,0.12);">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid rgba(0,0,0,0.06);border-radius:14px 14px 0 0;background:rgba(255,255,255,0.9);">
        <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:8px;background:rgba(0,0,0,0.04);font-size:14px;font-weight:500;">GPT-4o <span style="color:#5f6368;font-size:11px;">▾</span></span>
        <span style="display:flex;gap:4px;color:#5f6368;">
          <span style="width:30px;height:30px;border-radius:9px;background:rgba(0,0,0,0.04);display:inline-flex;align-items:center;justify-content:center;"><svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:currentColor;"><path d="M12 8a4 4 0 100 8 4 4 0 000-8zm9 4a7 7 0 00-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 00-2-1.2L16 2H8l-.5 2.5a7 7 0 00-2 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 003 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 002 1.2L8 22h8l.5-2.5a7 7 0 002-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"/></svg></span>
          <span style="width:30px;height:30px;border-radius:9px;background:rgba(0,0,0,0.04);display:inline-flex;align-items:center;justify-content:center;"><svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:currentColor;"><path d="M16 3l-1.4 1.4 1.1 1.1-4.3 4.3-2.1-2.1-1.4 1.4 3.5 3.5 5.7-5.7-1.1-1.1L19 6l3-3-6 0zM5 21h14v-2H5v2z"/></svg></span>
          <span style="width:30px;height:30px;border-radius:9px;background:rgba(0,0,0,0.04);display:inline-flex;align-items:center;justify-content:center;"><svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:currentColor;"><path d="M18.3 5.7L12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7l1.4-1.4L10.6 10.6 16.9 4.3z"/></svg></span>
        </span>
      </div>
      <div style="padding:8px;">
        <div style="margin:8px;padding:10px;background:rgba(255,255,255,0.92);border:1px solid rgba(0,0,0,0.06);border-left:3px solid rgba(0,0,0,0.12);border-radius:12px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
            <span style="flex:1;word-break:break-word;font-size:14px;">translation engine</span>
            <span style="width:18px;height:18px;color:#5f6368;flex-shrink:0;"><svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:currentColor;"><path d="M3 17.2V21h3.8L17.8 10 14 6.2 3 17.2zM20.7 7.3a1 1 0 000-1.4l-2.6-2.6a1 1 0 00-1.4 0l-1.8 1.8L18.9 9.1 20.7 7.3z"/></svg></span>
          </div>
        </div>
        <div style="margin:8px;padding:10px;background:rgba(255,255,255,0.92);border:1px solid rgba(0,0,0,0.06);border-left:3px solid rgba(74,140,247,0.7);border-radius:12px;font-weight:500;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
            <span style="flex:1;word-break:break-word;font-size:14px;">翻译引擎</span>
            <span style="width:18px;height:18px;color:#5f6368;flex-shrink:0;"><svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:currentColor;"><path d="M16 1H4a2 2 0 00-2 2v12h2V3h12V1zm3 4H8a2 2 0 00-2 2v14a2 2 0 002 2h11a2 2 0 002-2V7a2 2 0 00-2-2zm0 16H8V7h11v14z"/></svg></span>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

### 翻译面板

<div style="max-width:360px;margin:16px 0;background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:14px;box-shadow:0 8px 24px rgba(31,41,55,0.12);padding:14px 16px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,'PingFang SC','Microsoft YaHei',sans-serif;color:#1f2430;">
  <div style="display:flex;align-items:flex-end;gap:8px;">
    <div style="flex:1;min-width:0;min-height:56px;padding:12px 0;border:none;border-bottom:1px solid #eef0f4;background:transparent;font-size:14px;line-height:1.5;white-space:pre-wrap;word-break:break-word;">Hello world</div>
    <span style="width:32px;height:32px;border-radius:50%;background:#4a8cf7;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:14px;flex-shrink:0;">→</span>
  </div>
  <div style="display:flex;align-items:center;justify-content:space-between;margin:14px 0 4px;">
    <span style="flex:1;min-width:0;display:inline-flex;align-items:center;justify-content:space-between;gap:6px;height:34px;background:#f3f5fa;border-radius:9px;padding:0 10px;font-size:13px;color:#1f2430;box-sizing:border-box;"><span>自动检测</span><span style="color:#9aa3b2;">▾</span></span>
    <span style="width:32px;text-align:center;color:#4a8cf7;font-size:20px;flex-shrink:0;">⇄</span>
    <span style="flex:1;min-width:0;display:inline-flex;align-items:center;justify-content:space-between;gap:6px;height:34px;background:#f3f5fa;border-radius:9px;padding:0 10px;font-size:13px;color:#1f2430;box-sizing:border-box;"><span>中文简体</span><span style="color:#9aa3b2;">▾</span></span>
  </div>
  <div style="margin-top:12px;padding:12px 0 0;border-top:1px solid #eef0f4;font-size:14px;color:#1f2430;">你好，世界</div>
  <div style="text-align:center;font-size:11px;color:#9aa3b2;margin-top:14px;">©2025 lightrans</div>
</div>
## 功能特性

- **跨浏览器支持**：支持 Chrome 和 Firefox
- **AI 驱动翻译**：使用先进的 AI 模型提供准确的翻译
- **上下文菜单集成**：易于使用的上下文菜单，方便快速翻译
- **整页翻译**：支持完整的页面翻译
- **多语言支持**：英语、中文（简体）、中文（繁体）、日语
- **高度可定制**：灵活的设置，满足个性化翻译需求

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

## 许可证

MIT License
