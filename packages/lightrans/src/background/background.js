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
import { BROWSER_LANGUAGES_MAP } from "common/scripts/languages.js";
import { DEFAULT_SETTINGS, setDefaultSettings } from "common/scripts/settings.js";

/**
 * BEGIN SETTING UP CONTEXT MENUS
 */
if (chrome.contextMenus) {
    chrome.contextMenus.create({
        id: "translate",
        title: `${chrome.i18n.getMessage("Translate")} '%s'`,
        contexts: ["selection"],
    });

    if (BROWSER_ENV === "firefox") {
        chrome.contextMenus.create({
            id: "settings",
            title: chrome.i18n.getMessage("Settings"),
            contexts: ["action"],
        });
    }

    chrome.contextMenus.create({
        id: "shortcut",
        title: chrome.i18n.getMessage("ShortcutSetting"),
        contexts: ["action"],
    });

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
 * Initialize and migrate settings when the extension is updated.
 */
chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === "update") {
        await new Promise((resolve) => {
            chrome.storage.sync.get((result) => {
                const buffer = result;
                setDefaultSettings(buffer, DEFAULT_SETTINGS);
                chrome.storage.sync.set(buffer, resolve);
            });
        });

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

const channel = new Channel();
const TRANSLATOR_MANAGER = new TranslatorManager(channel);

/**
 * Handle extension context-menu actions.
 */
try {
    const contextMenus = chrome && chrome.contextMenus;
    if (contextMenus) {
        const onClicked = contextMenus.onClicked;
        if (onClicked) {
            onClicked.addListener((info, tab) => {
                if (info && info.menuItemId && info.menuItemId.startsWith("translate_page_")) {
                    const model = info.menuItemId.replace("translate_page_", "");
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
    console.error("lightrans: Error adding contextMenus listener:", error);
}

chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (tab.url && tab.url.length > 0) {
            updateBLackListMenu(tab.url);
        }
    });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tab.active && tab.url && tab.url.length > 0) {
        updateBLackListMenu(tab.url);
    }
});

channel.on("redirect", (detail, sender) => chrome.tabs.update(sender.tab.id, { url: detail.url }));
channel.on("open_options_page", () => chrome.runtime.openOptionsPage());
channel.on("page_translate_event", (detail, sender) => {
    channel.emitToTabs(sender.tab.id, "page_translate_event", detail);
});

channel.provide("get_lang", () => {
    return Promise.resolve({
        lang: BROWSER_LANGUAGES_MAP[chrome.i18n.getUILanguage()],
    });
});

/**
 * Handle page translation requests from content scripts.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "TRANSLATE_PAGE_CONTENT") {
        (async () => {
            await TRANSLATOR_MANAGER.config_loader;

            const requestedModel =
                message.model && message.model !== "default"
                    ? message.model
                    : TRANSLATOR_MANAGER.AI_MODEL;
            const originalModel = TRANSLATOR_MANAGER.AI_MODEL;

            if (requestedModel !== originalModel) {
                TRANSLATOR_MANAGER.AI_TRANSLATOR.setCurrentModel(requestedModel);
            }

            const finish = (payload) => {
                if (requestedModel !== originalModel) {
                    TRANSLATOR_MANAGER.AI_TRANSLATOR.setCurrentModel(originalModel);
                }
                sendResponse(payload);
            };

            try {
                const texts = message.content.texts;
                const targetLang = TRANSLATOR_MANAGER.LANGUAGE_SETTING.tl;
                const translatedTexts = await TRANSLATOR_MANAGER.AI_TRANSLATOR.translateBatch(
                    texts,
                    "auto",
                    targetLang
                );

                finish({
                    translatedContent: {
                        texts: translatedTexts,
                    },
                });
            } catch (error) {
                const errorMessage = String((error && error.message) || error);

                if (/transient|429|rate\s*limit/i.test(errorMessage)) {
                    finish({ rateLimited: true, error: errorMessage });
                } else {
                    console.error("Page translation error:", error);
                    finish({ error: errorMessage });
                }
            }
        })();
        return true;
    }
    return false;
});

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

if (BUILD_ENV === "development" && BROWSER_ENV === "chrome") {
    import("./library/hot_reload.js").then((module) => {
        module.hotReload();
    });
}
