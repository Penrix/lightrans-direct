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
    // Provider: siliconflow | gemini
    TranslationProvider: "siliconflow",
    // Shared active model. The options page replaces it with the provider default when provider changes.
    AIModel: "tencent/Hunyuan-MT-7B",
    // Page translation display mode: original | translated | bilingual
    PageTranslationDisplayMode: "translated",
    // Allow an arbitrary provider model id instead of the built-in list.
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

/**
 * Assign default values recursively without overwriting existing values.
 *
 * @param {*} result stored settings
 * @param {*} settings defaults
 */
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
 *
 * @param {String | Array<String>} settings setting names
 * @param {Object | Function} defaults default values
 * @returns {Promise<Any>} settings
 */
function getOrSetDefaultSettings(settings, defaults) {
    return new Promise((resolve) => {
        if (typeof settings === "string") {
            settings = [settings];
        } else if (settings === undefined) {
            settings = Object.keys(defaults);
        }

        chrome.storage.sync.get(settings, (result) => {
            let updated = false;

            for (let setting of settings) {
                if (result[setting] === undefined) {
                    if (typeof defaults === "function") {
                        defaults = defaults(settings);
                    }
                    result[setting] = defaults[setting];
                    updated = true;
                }
            }

            if (updated) {
                chrome.storage.sync.set(result, () => resolve(result));
            } else {
                resolve(result);
            }
        });
    });
}

/**
 * Read provider secrets from local-only extension storage.
 *
 * @returns {Promise<{ProviderSecrets: {siliconflow: string, gemini: string}}>} local secrets
 */
function getOrSetLocalSecrets() {
    return new Promise((resolve) => {
        chrome.storage.local.get(["ProviderSecrets"], (result) => {
            const secrets = result || {};
            setDefaultSettings(secrets, DEFAULT_SECRETS);
            chrome.storage.local.set({ ProviderSecrets: secrets.ProviderSecrets }, () => resolve(secrets));
        });
    });
}

/**
 * Save one provider API key locally. Never sync it through the browser account.
 *
 * @param {string} provider siliconflow | gemini
 * @param {string} key API key
 * @returns {Promise<void>} completion
 */
async function setProviderSecret(provider, key) {
    const local = await getOrSetLocalSecrets();
    local.ProviderSecrets[provider] = (key || "").trim();
    return new Promise((resolve) => {
        chrome.storage.local.set({ ProviderSecrets: local.ProviderSecrets }, resolve);
    });
}

/**
 * One-time migration from upstream Lightrans, which stored ApiKey in chrome.storage.sync.
 * The legacy key represented SiliconFlow only. Copy it locally, then remove the synced copy.
 *
 * @returns {Promise<boolean>} true when a key was migrated
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

            const removals = [];
            if (legacy.ApiKey !== undefined) removals.push("ApiKey");
            if (legacy.TranslationService !== undefined) removals.push("TranslationService");

            if (removals.length > 0) {
                chrome.storage.sync.remove(removals, () => resolve(!!legacyKey));
            } else {
                resolve(false);
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
