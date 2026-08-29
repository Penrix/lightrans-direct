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
 * If an upstream installation left ApiKey in sync storage, migrate it to the
 * device-local SiliconFlow secret slot and delete the synced copy immediately.
 */
function getOrSetDefaultSettings(settings, defaults = DEFAULT_SETTINGS) {
    return new Promise((resolve) => {
        if (typeof settings === "string") {
            settings = [settings];
        } else if (settings === undefined) {
            settings = Object.keys(defaults);
        }

        const requested = settings;
        const wantsLegacyApiKey = requested.includes("ApiKey");
        const storageKeys = requested.filter((key) => key !== "ApiKey");
        if (wantsLegacyApiKey) storageKeys.push("ApiKey");

        chrome.storage.sync.get(storageKeys, async (stored) => {
            const legacyApiKey = (stored.ApiKey || "").trim();
            delete stored.ApiKey;

            if (legacyApiKey) {
                const local = await getOrSetLocalSecrets();
                if (!local.ProviderSecrets.siliconflow) {
                    await setProviderSecret("siliconflow", legacyApiKey);
                }
                await new Promise((done) => chrome.storage.sync.remove(["ApiKey"], done));
            }

            let updated = false;
            for (const setting of requested) {
                if (setting === "ApiKey") continue;
                if (stored[setting] === undefined) {
                    if (typeof defaults === "function") {
                        defaults = defaults(settings);
                    }
                    stored[setting] = defaults[setting];
                    updated = true;
                }
            }

            // Normalize relay-era values without creating a new setting key.
            if (stored.TranslationService === "free" || stored.TranslationService === "custom") {
                stored.TranslationService = "siliconflow";
                updated = true;
            }

            const result = { ...stored };
            if (wantsLegacyApiKey) result.ApiKey = legacyApiKey;

            if (updated) {
                chrome.storage.sync.set(stored, () => resolve(result));
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

function migrateLegacyApiKey() {
    return getOrSetDefaultSettings(["TranslationService", "ApiKey"], DEFAULT_SETTINGS)
        .then((result) => !!result.ApiKey);
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
