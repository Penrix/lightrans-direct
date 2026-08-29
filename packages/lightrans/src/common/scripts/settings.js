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
    // Kept for compatibility with the upstream settings shape. Lightrans Direct
    // intentionally supports only direct SiliconFlow requests now.
    TranslationService: "siliconflow",
    AIModel: "THUDM/GLM-4-9B-0414",
    PageTranslationDisplayMode: "translated",
    CustomModel: false,
    CustomModelName: "",
    // Deterministic terminology layer. The glossary starts empty: software/product
    // names are normally preserved as proper names, while automatic annotation is
    // aimed at technical concepts, domain nouns and acronyms that benefit from a gloss.
    GlossaryEnabled: true,
    AutoAnnotateTerms: true,
    GlossaryText: "",
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
    },
};

const LEGACY_OBSIDIAN_GLOSSARY = "Obsidian = Obsidian（笔记与知识管理软件）";

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

            // Normalize relay-era and removed-provider values.
            if (
                stored.TranslationService === "free" ||
                stored.TranslationService === "custom" ||
                stored.TranslationService === "gemini"
            ) {
                stored.TranslationService = "siliconflow";
                updated = true;
            }
            if (typeof stored.AIModel === "string" && /^gemini-/i.test(stored.AIModel)) {
                stored.AIModel = "THUDM/GLM-4-9B-0414";
                updated = true;
            }

            // v1 briefly shipped an Obsidian software-name annotation as the default
            // glossary. Remove only that exact untouched default; user-edited glossary
            // content is preserved.
            if (
                requested.includes("GlossaryText") &&
                typeof stored.GlossaryText === "string" &&
                stored.GlossaryText.trim() === LEGACY_OBSIDIAN_GLOSSARY
            ) {
                stored.GlossaryText = "";
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
            // Drop removed provider secrets instead of keeping unused API keys around.
            secrets.ProviderSecrets = {
                siliconflow: (secrets.ProviderSecrets && secrets.ProviderSecrets.siliconflow) || "",
            };
            chrome.storage.local.set({ ProviderSecrets: secrets.ProviderSecrets }, () => resolve(secrets));
        });
    });
}

async function setProviderSecret(provider, key) {
    if (provider !== "siliconflow") return Promise.resolve();
    const local = await getOrSetLocalSecrets();
    local.ProviderSecrets.siliconflow = (key || "").trim();
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