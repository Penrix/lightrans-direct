import { TranslatorManager, translatePage } from "./library/translate.js";
import {
    addUrlBlacklist,
    addDomainBlacklist,
    removeUrlBlacklist,
    removeDomainBlacklist,
    updateBLackListMenu,
} from "./library/blacklist.js";
import { promiseTabs } from "common/scripts/promise.js";
import Channel from "common/scripts/channel.js";
import { getDomain } from "common/scripts/common.js";
// map language abbreviation from browser languages to translation languages
import { BROWSER_LANGUAGES_MAP } from "common/scripts/languages.js";
import { DEFAULT_SETTINGS, setDefaultSettings } from "common/scripts/settings.js";

/**
 * BEGIN SETTING UP CONTEXT MENUS
 */
// 确保 chrome.contextMenus 可用时才创建菜单
if (chrome.contextMenus) {
    // 创建选择翻译菜单
    chrome.contextMenus.create({
        id: "translate",
        title: `${chrome.i18n.getMessage("Translate")} '%s'`,
        contexts: ["selection"],
    });

    // Add an entry to options page for Firefox as it doesn't have one.
    if (BROWSER_ENV === "firefox") {
        chrome.contextMenus.create({
            id: "settings",
            title: chrome.i18n.getMessage("Settings"),
            contexts: ["action"],
        });
    }

    // 创建快捷键设置菜单
    chrome.contextMenus.create({
        id: "shortcut",
        title: chrome.i18n.getMessage("ShortcutSetting"),
        contexts: ["action"],
    });

    // 创建黑名单相关菜单
    chrome.contextMenus.create({
        id: "add_url_blacklist",
        title: chrome.i18n.getMessage("AddUrlBlacklist"),
        contexts: ["action"],
        enabled: false,
        visible: false,
    });

    chrome.contextMenus.create({
        id: "add_domain_blacklist",
        title: chrome.i18n.getMessage("AddDomainBlacklist"),
        contexts: ["action"],
        enabled: false,
        visible: false,
    });

    chrome.contextMenus.create({
        id: "remove_url_blacklist",
        title: chrome.i18n.getMessage("RemoveUrlBlacklist"),
        contexts: ["action"],
        enabled: false,
        visible: false,
    });

    chrome.contextMenus.create({
        id: "remove_domain_blacklist",
        title: chrome.i18n.getMessage("RemoveDomainBlacklist"),
        contexts: ["action"],
        enabled: false,
        visible: false,
    });
}
/**
 * END SETTING UP CONTEXT MENUS
 */

/**
 * 初始化插件配置。
 */
chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === "update") {
        await new Promise((resolve) => {
            chrome.storage.sync.get((result) => {
                let buffer = result; // use var buffer as a pointer
                setDefaultSettings(buffer, DEFAULT_SETTINGS); // assign default value to buffer
                chrome.storage.sync.set(buffer, resolve);
            });
        });

        // Fix language setting compatibility between Edge Translate 2.x and 1.x.x.
        chrome.storage.sync.get("languageSetting", (result) => {
            if (!result.languageSetting) return;

            if (result.languageSetting.sl === "zh-cn") {
                result.languageSetting.sl = "zh-CN";
            } else if (result.languageSetting.sl === "zh-tw") {
                result.languageSetting.sl = "zh-TW";
            }

            if (result.languageSetting.tl === "zh-cn") {
                result.languageSetting.tl = "zh-CN";
            } else if (result.languageSetting.tl === "zh-tw") {
                result.languageSetting.tl = "zh-TW";
            }
            chrome.storage.sync.set(result);
        });
    }
});

/**
 * Create communication channel.
 */
const channel = new Channel();

/**
 * Create translator manager and register event listeners and service providers.
 */
const TRANSLATOR_MANAGER = new TranslatorManager(channel);



/**
 * 监听用户点击通知事件
 */
// 使用try-catch块来安全地添加notifications监听器，避免构建过程中的问题
try {
    // 尝试获取notifications对象
    const notifications = chrome && chrome.notifications;
    if (notifications) {
        // 尝试获取onClicked事件
        const onClicked = notifications.onClicked;
        if (onClicked) {
            onClicked.addListener((notificationId) => {
                if (notificationId) {
                    switch (notificationId) {
                        case "update_notification":
                            chrome.tabs.create({
                                // 为releases页面创建一个新的标签页
                                url: "https://github.com/W4J1e/Lightrans/releases",
                            });
                            break;
                        case "data_collection_notification":
                            chrome.tabs.create({
                                // 为设置页面单独创建一个标签页
                                url: chrome.runtime.getURL("options/options.html"),
                            });
                            break;
                        default:
                            break;
                    }
                }
            });
        }
    }
} catch (error) {
    // 忽略所有错误，避免影响扩展的其他功能
    console.error('lightrans: Error adding notifications listener:', error);
}

/**
 * 添加点击菜单后的处理事件
 */
// 使用try-catch块来安全地添加contextMenus监听器，避免构建过程中的问题
try {
    // 尝试获取contextMenus对象
    const contextMenus = chrome && chrome.contextMenus;
    if (contextMenus) {
        // 尝试添加监听器
        const onClicked = contextMenus.onClicked;
        if (onClicked) {
            onClicked.addListener((info, tab) => {
                // 检查是否是模型子菜单的点击事件
                if (info && info.menuItemId && info.menuItemId.startsWith("translate_page_")) {
                    // 从菜单项ID中提取模型名称
                    const model = info.menuItemId.replace("translate_page_", "");
                    console.log('lightrans: translate_page model submenu clicked, model:', model);
                    translatePage(channel, model);
                } else if (info && info.menuItemId) {
                    switch (info.menuItemId) {
                        case "translate":
                            if (channel && tab && tab.id) {
                                channel
                                    .requestToTab(tab.id, "get_selection")
                                    .then(({ text, position, selectionHeight }) => {
                                        if (text) {
                                            return TRANSLATOR_MANAGER.translate(text, position, selectionHeight);
                                        }
                                        return Promise.reject();
                                    })
                                    .catch((error) => {
                                        // If content scripts can not access the tab the selection, use info.selectionText instead.
                                        if (info.selectionText && info.selectionText.trim()) {
                                            return TRANSLATOR_MANAGER.translate(info.selectionText, null);
                                        }
                                        return Promise.resolve(error);
                                    });
                            }
                            break;
                        case "settings":
                            chrome.runtime.openOptionsPage();
                            break;
                        case "shortcut":
                            chrome.tabs.create({
                                url: "chrome://extensions/shortcuts",
                            });
                            break;
                        case "add_url_blacklist":
                            addUrlBlacklist();
                            break;
                        case "remove_url_blacklist":
                            removeUrlBlacklist();
                            break;
                        case "add_domain_blacklist":
                            addDomainBlacklist();
                            break;
                        case "remove_domain_blacklist":
                            removeDomainBlacklist();
                            break;
                        default:
                            break;
                    }
                }
            });
        }
    }
} catch (error) {
    // 忽略所有错误，避免影响扩展的其他功能
    console.error('lightrans: Error adding contextMenus listener:', error);
}

/**
 * 添加tab切换事件监听，用于更新黑名单信息
 */
chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (tab.url && tab.url.length > 0) {
            updateBLackListMenu(tab.url);
        }
    });
});

/**
 * 添加tab刷新事件监听，用于更新黑名单信息
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tab.active && tab.url && tab.url.length > 0) {
        updateBLackListMenu(tab.url);
    }
});

/**
 * Redirect tab when redirect event happens.
 */
channel.on("redirect", (detail, sender) => chrome.tabs.update(sender.tab.id, { url: detail.url }));

/**
 * Open options page when open_options_page button clicked.
 */
channel.on("open_options_page", () => chrome.runtime.openOptionsPage());

/**
 * Forward page translate event back to pages.
 */
channel.on("page_translate_event", (detail, sender) => {
    channel.emitToTabs(sender.tab.id, "page_translate_event", detail);
});

/**
 * Provide UI language detecting service.
 */
channel.provide("get_lang", () => {
    return Promise.resolve({
        lang: BROWSER_LANGUAGES_MAP[chrome.i18n.getUILanguage()],
    });
});

/**
 * Handle page translation requests from content scripts.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'TRANSLATE_PAGE_CONTENT') {
        // 使用AI翻译器直接翻译网页内容
        (async () => {
            try {
                // 确保配置已初始化
                await TRANSLATOR_MANAGER.config_loader;
                
                // 获取请求中的模型参数，默认为当前设置的模型
                const requestedModel = message.model && message.model !== 'default' ? message.model : TRANSLATOR_MANAGER.AI_MODEL;
                
                // 保存当前模型，用于翻译后恢复
                const originalModel = TRANSLATOR_MANAGER.AI_MODEL;
                
                // 如果请求的模型不同，临时切换模型
                if (requestedModel !== originalModel) {
                    TRANSLATOR_MANAGER.AI_TRANSLATOR.setCurrentModel(requestedModel);
                }
                
                // 直接使用对象，无需JSON.parse
                const contentData = message.content;
                const { texts: filteredTexts, indices: textIndices } = contentData;
                
                // 检测源语言并设置目标语言
                const targetLang = TRANSLATOR_MANAGER.LANGUAGE_SETTING.tl;
                
                // 翻译结果数组
                const translatedTexts = [];
                
                // 逐个翻译文本，支持分批次翻译，添加请求节流和重试机制
                for (let i = 0; i < filteredTexts.length; i++) {
                    const text = filteredTexts[i];
                    let retries = 3; // 最多重试3次
                    let success = false;
                    
                    while (retries > 0 && !success) {
                        try {
                            // 直接翻译单个文本，避免合并和拆分问题
                            const result = await TRANSLATOR_MANAGER.AI_TRANSLATOR.translate(text, 'auto', targetLang);
                            translatedTexts[i] = result.mainMeaning;
                            success = true;
                        } catch (translateError) {
                            retries--;
                            console.error('Translation error for text:', text, translateError);
                            
                            if (retries > 0) {
                                console.log('Retrying...', retries, 'attempts left');
                                // 重试前等待一段时间，避免频繁请求
                                await new Promise(resolve => setTimeout(resolve, 1000));
                            } else {
                                // 所有重试都失败，保留原文
                                translatedTexts[i] = text;
                                console.error('All retries failed, keeping original text');
                            }
                        }
                    }
                    
                    // 每翻译10个文本等待一段时间，避免请求过快
                    if ((i + 1) % 10 === 0) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }
                
                // 确保所有文本都有翻译结果
                for (let i = 0; i < filteredTexts.length; i++) {
                    if (!translatedTexts[i]) {
                        translatedTexts[i] = filteredTexts[i];
                    }
                }
                
                // 恢复原始模型
                if (requestedModel !== originalModel) {
                    TRANSLATOR_MANAGER.AI_TRANSLATOR.setCurrentModel(originalModel);
                }
                
                // 发送翻译结果回注入脚本，直接传递对象
                sendResponse({
                    translatedContent: {
                        texts: translatedTexts,
                        indices: textIndices
                    }
                });
            } catch (error) {
                console.error('Page translation error:', error);
                sendResponse({
                    error: error.message
                });
            }
        })();
        return true; // 表示我们将异步发送响应
    }
    return false;
});

/**
 *  将快捷键消息转发给content_scripts
 */
chrome.commands.onCommand.addListener((command) => {
    switch (command) {
        case "translate_page":
            translatePage(channel);
            break;
        default:
            promiseTabs
                .query({ active: true, currentWindow: true })
                .then((tabs) => channel.emitToTabs(tabs[0].id, "command", { command }))
                .catch(() => {});
            break;
    }
});





/**
 * dynamic importing hot reload function only in development env
 */
if (BUILD_ENV === "development" && BROWSER_ENV === "chrome") {
    import("./library/hot_reload.js").then((module) => {
        module.hotReload();
    });
}
