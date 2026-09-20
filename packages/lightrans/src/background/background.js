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

function englishToSimplifiedChineseOnly() {
    return !!TRANSLATOR_MANAGER.OTHER_SETTINGS?.EnglishToSimplifiedChineseOnly;
}

function isEnglishLanguage(language) {
    return /^en(?:-|$)/i.test(String(language || ""));
}

function unchangedTranslationResult(text) {
    return {
        originalText: text,
        mainMeaning: text,
        tPronunciation: "",
        sPronunciation: "",
        detailedMeanings: [],
        definitions: [],
        examples: [],
        skipped: true,
    };
}

/**
 * In one-way mode, selection translation should not even open the result bubble
 * for Chinese or other non-English text. AITranslator.detect() is local and does
 * not spend an API request, so this gate is cheap and deterministic.
 */
const translateSelectionNormally = TRANSLATOR_MANAGER.translate.bind(TRANSLATOR_MANAGER);
TRANSLATOR_MANAGER.translate = async function (text, position, selectionHeight = 0) {
    await this.config_loader;
    if (!this.OTHER_SETTINGS?.EnglishToSimplifiedChineseOnly) {
        return translateSelectionNormally(text, position, selectionHeight);
    }

    const detected = await this.AI_TRANSLATOR.detect(text);
    if (!isEnglishLanguage(detected)) {
        return { skipped: true, sourceLanguage: detected };
    }

    const currentTabId = await this.getCurrentTabId();
    if (currentTabId === -1) return { skipped: true };

    const timestamp = new Date().getTime();
    this.channel.emitToTabs(currentTabId, "start_translating", {
        text,
        position,
        selectionHeight,
        timestamp,
    });

    try {
        const result = await this.AI_TRANSLATOR.translate(text, "en", "zh-CN");
        result.sourceLanguage = "en";
        result.targetLanguage = "zh-CN";
        this.channel.emitToTabs(currentTabId, "translating_finished", {
            timestamp,
            ...result,
        });
        return result;
    } catch (error) {
        const message = String((error && (error.message || error.errorMsg)) || error);
        let errorType = "API_ERR";
        if (/transient|429|rate\s*limit|status code 5\d{2}/i.test(message)) {
            errorType = "MODEL_BUSY";
        } else if (/network|timeout|NET_ERR|ECONN|failed to fetch/i.test(message)) {
            errorType = "NET_ERR";
        }
        this.channel.emitToTabs(currentTabId, "translating_error", {
            error: {
                errorType,
                errorCode: 0,
                errorMsg: message,
            },
            timestamp,
        });
        return { error: message };
    }
};

/**
 * Popup translation is registered inside TranslatorManager, so enforce the same
 * one-way direction at the translator boundary. Non-English popup input is left
 * unchanged instead of being translated into English.
 */
TRANSLATOR_MANAGER.config_loader.then(() => {
    const translator = TRANSLATOR_MANAGER.AI_TRANSLATOR;
    const translateNormally = translator.translate.bind(translator);
    translator.translate = async (text, from, to) => {
        if (!englishToSimplifiedChineseOnly()) {
            return translateNormally(text, from, to);
        }

        let detected = from;
        if (!detected || detected === "auto") {
            detected = await translator.detect(text);
        }
        if (!isEnglishLanguage(detected)) {
            return unchangedTranslationResult(text);
        }
        return translateNormally(text, "en", "zh-CN");
    };
});

/**
 * Keep the page-translation context menu in sync with the active provider.
 * TranslatorManager updates its provider from the same storage event; a short
 * delay lets that update settle before rebuilding the provider-specific menu.
 */
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.TranslationService) {
        setTimeout(() => {
            TRANSLATOR_MANAGER.config_loader
                .then(() => TRANSLATOR_MANAGER.updateTranslatePageMenu())
                .catch(() => {});
        }, 120);
    }
});

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
 * Explicit popup action for translating the active page with the currently
 * selected provider/model. This uses the same path as the right-click menu.
 */
channel.provide("translate_current_page", async (params) => {
    await TRANSLATOR_MANAGER.config_loader;
    translatePage(channel, params && params.model ? params.model : undefined);
    return { started: true };
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
                let translatedTexts;

                if (englishToSimplifiedChineseOnly()) {
                    // Keep non-English segments exactly as they are. detect() is a
                    // local regex-based check, so filtering does not add API calls.
                    translatedTexts = texts.slice();
                    const englishIndices = [];
                    const englishTexts = [];

                    for (let i = 0; i < texts.length; i++) {
                        const detected = await TRANSLATOR_MANAGER.AI_TRANSLATOR.detect(texts[i]);
                        if (isEnglishLanguage(detected)) {
                            englishIndices.push(i);
                            englishTexts.push(texts[i]);
                        }
                    }

                    if (englishTexts.length > 0) {
                        const batch = await TRANSLATOR_MANAGER.AI_TRANSLATOR.translateBatch(
                            englishTexts,
                            "en",
                            "zh-CN"
                        );
                        englishIndices.forEach((originalIndex, translatedIndex) => {
                            translatedTexts[originalIndex] = batch[translatedIndex];
                        });
                    }
                } else {
                    const sourceLang = TRANSLATOR_MANAGER.LANGUAGE_SETTING.sl || "auto";
                    const targetLang = TRANSLATOR_MANAGER.LANGUAGE_SETTING.tl;
                    translatedTexts = await TRANSLATOR_MANAGER.AI_TRANSLATOR.translateBatch(
                        texts,
                        sourceLang,
                        targetLang
                    );
                }

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
