import { BROWSER_LANGUAGES_MAP } from "common/scripts/languages.js";

/**
 * Settings that are safe to sync between browsers.
 * Provider API keys are intentionally excluded and live in chrome.storage.local.
 */
const DEFAULT_SETTINGS = {
    blacklist: {
        urls: {},
        domains: { "chrome.google.com": true, extensions: true },
    },
    LayoutSettings: {
        Resize: false,
        RTL: false,
        FoldLongContent: true,
        SelectTranslatePosition: "TopRight",
    },
    languageSetting: { sl: "auto", tl: BROWSER_LANGUAGES_MAP[chrome.i18n.getUILanguage()] },
    OtherSettings: {
        MutualTranslate: true,
        SelectTranslate: true,
        TranslateAfterDblClick: false,
        TranslateAfterSelect: false,
        CancelTextSelection: false,
        UsePDFjs: true,
    },
    DefaultTranslator: "AITrans",
    DefaultPageTranslator: "AITrans",
    // Reuses the upstream setting key, but values now mean direct providers instead of relay modes.
    // siliconflow | gemini
    TranslationService: "siliconflow",
    AIModel: "tencent/Hunyuan-MT-7B",
    PageTranslationDisplayMode: "translated",
    CustomModel: false,
    CustomModelName: "",
    HybridTranslatorConfig: {
        translators: ["AITrans"],
        selections: {
            originalText: "AITrans",
            mainMeaning: "AITrans",
            tPronunciation: "AITrans",
            sPronunciation: "AITrans",
            detailedMeanings: "AITrans",
            definitions: "AITrans",
            examples: "AITrans",
        },
    },
    HidePageTranslatorBanner: false,
};

/**
 * Secrets are device-local by design. They are not written to chrome.storage.sync.
 */
const DEFAULT_SECRETS = {
    ProviderSecrets: {
        siliconflow: "",
        gemini: "",
    },
};

function setDefaultSettings(result, settings) {
    for (let i in settings) {
        if (
            typeof settings[i] === "object" &&
            !(settings[i] instanceof Array) &&
            Object.keys(settings[i]).length > 0
        ) {
            if (result[i]) {
                setDefaultSettings(result[i], settings[i]);
            } else {
                result[i] = settings[i];
            }
        } else if (result[i] === undefined) {
            result[i] = settings[i];
        }
    }
}

/**
 * Get synced settings and initialize missing defaults.
 * Legacy callers can still request ApiKey; it is returned as an empty compatibility
 * value and is never initialized in sync storage.
 */
function getOrSetDefaultSettings(settings, defaults) {
    return new Promise((resolve) => {
        if (typeof settings === "string") {
            settings = [settings];
        } else if (settings === undefined) {
            settings = Object.keys(defaults);
        }

        const requested = settings;
        const syncedSettings = requested.filter((key) => key !== "ApiKey");

        chrome.storage.sync.get(syncedSettings, (result) => {
            let updated = false;

            for (let setting of syncedSettings) {
                if (result[setting] === undefined) {
                    if (typeof defaults === "function") {
                        defaults = defaults(settings);
                    }
                    result[setting] = defaults[setting];
                    updated = true;
                }
            }

            if (requested.includes("ApiKey")) {
                result.ApiKey = "";
            }

            if (updated) {
                const safeResult = { ...result };
                delete safeResult.ApiKey;
                chrome.storage.sync.set(safeResult, () => resolve(result));
            } else {
                resolve(result);
            }
        });
    });
}

function getOrSetLocalSecrets() {
    return new Promise((resolve) => {
        chrome.storage.local.get(["ProviderSecrets"], (result) => {
            const secrets = result || {};
            setDefaultSettings(secrets, DEFAULT_SECRETS);
            chrome.storage.local.set({ ProviderSecrets: secrets.ProviderSecrets }, () => resolve(secrets));
        });
    });
}

async function setProviderSecret(provider, key) {
    const local = await getOrSetLocalSecrets();
    local.ProviderSecrets[provider] = (key || "").trim();
    return new Promise((resolve) => {
        chrome.storage.local.set({ ProviderSecrets: local.ProviderSecrets }, resolve);
    });
}

/**
 * One-time migration from upstream Lightrans, which stored the SiliconFlow key in sync.
 */
function migrateLegacyApiKey() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(["ApiKey", "TranslationService"], async (legacy) => {
            const legacyKey = (legacy.ApiKey || "").trim();
            if (legacyKey) {
                const local = await getOrSetLocalSecrets();
                if (!local.ProviderSecrets.siliconflow) {
                    await setProviderSecret("siliconflow", legacyKey);
                }
            }

            const updates = {};
            if (legacy.TranslationService === "free" || legacy.TranslationService === "custom") {
                updates.TranslationService = "siliconflow";
            }

            const finish = () => {
                if (legacy.ApiKey !== undefined) {
                    chrome.storage.sync.remove(["ApiKey"], () => resolve(!!legacyKey));
                } else {
                    resolve(false);
                }
            };

            if (Object.keys(updates).length > 0) {
                chrome.storage.sync.set(updates, finish);
            } else {
                finish();
            }
        });
    });
}

export {
    DEFAULT_SETTINGS,
    DEFAULT_SECRETS,
    setDefaultSettings,
    getOrSetDefaultSettings,
    getOrSetLocalSecrets,
    setProviderSecret,
    migrateLegacyApiKey,
};
