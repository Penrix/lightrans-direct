import { i18nHTML } from "common/scripts/common.js";
import {
    DEFAULT_SETTINGS,
    getOrSetDefaultSettings,
    getOrSetLocalSecrets,
    setProviderSecret,
} from "common/scripts/settings.js";

const PROVIDER_MODELS = {
    siliconflow: [
        "tencent/Hunyuan-MT-7B",
        "THUDM/GLM-4-9B-0414",
        "Qwen/Qwen3.5-4B",
    ],
    gemini: ["gemini-3.7-flash", "gemini-3.5-flash-lite", "gemini-3.5-flash"],
};

window.onload = async () => {
    i18nHTML();

    const settings = await getOrSetDefaultSettings(undefined, DEFAULT_SETTINGS);
    const localSecrets = await getOrSetLocalSecrets();

    const serviceSelect = document.getElementById("translation-service");
    const apiKeyInput = document.getElementById("api-key");
    const apiKeyProviderLabel = document.getElementById("apikey-provider-label");
    const privacyNote = document.getElementById("provider-privacy-note");
    const customModelCheckbox = document.getElementById("custom-model");
    const aiModelSelect = document.getElementById("ai-model");
    const aiModelInput = document.getElementById("ai-model-input");

    function currentProvider() {
        return serviceSelect && serviceSelect.value === "gemini" ? "gemini" : "siliconflow";
    }

    function populateModels(provider, selectedModel) {
        if (!aiModelSelect) return;
        const models = PROVIDER_MODELS[provider] || PROVIDER_MODELS.siliconflow;
        aiModelSelect.innerHTML = "";
        for (const model of models) {
            const option = document.createElement("option");
            option.value = model;
            option.textContent = model;
            aiModelSelect.appendChild(option);
        }
        aiModelSelect.value = models.includes(selectedModel) ? selectedModel : models[0];
    }

    function syncCustomModelVisibility() {
        if (!customModelCheckbox) return;
        const checked = customModelCheckbox.checked;
        if (aiModelSelect) aiModelSelect.style.display = checked ? "none" : "";
        if (aiModelInput) aiModelInput.style.display = checked ? "" : "none";

        if (checked && aiModelInput && aiModelInput.value.trim()) {
            saveOption(settings, ["AIModel"], aiModelInput.value.trim());
        } else if (!checked && aiModelSelect && aiModelSelect.value) {
            saveOption(settings, ["AIModel"], aiModelSelect.value);
        }
    }

    function syncProviderUi() {
        const provider = currentProvider();
        const providerName = provider === "gemini" ? "Gemini" : "SiliconFlow";
        if (apiKeyProviderLabel) apiKeyProviderLabel.textContent = `${providerName} API Key：`;
        if (apiKeyInput) {
            apiKeyInput.value = localSecrets.ProviderSecrets[provider] || "";
            apiKeyInput.placeholder = `仅保存在本机浏览器中的 ${providerName} API Key`;
        }
        if (privacyNote) {
            privacyNote.textContent = provider === "gemini"
                ? "Gemini 免费层：网页文本会直传 Google；Google 当前说明免费层内容可能用于改进产品。"
                : "SiliconFlow：网页文本会直传 SiliconFlow；本扩展不经过开发者中继服务器。";
        }
        syncCustomModelVisibility();
    }

    populateModels(
        settings.TranslationService === "gemini" ? "gemini" : "siliconflow",
        settings.AIModel
    );

    const inputElements = document.getElementsByTagName("input");
    const selectElements = document.querySelectorAll("select[setting-type='select']");
    for (let element of [...inputElements, ...selectElements]) {
        const type = element.getAttribute("setting-type");
        const path = element.getAttribute("setting-path");
        if (!type || !path) continue;

        const settingItemPath = path.split(/\s/g);
        const settingItemValue = getSetting(settings, settingItemPath);

        switch (type) {
            case "checkbox":
                element.checked = settingItemValue.indexOf(element.value) !== -1;
                element.onchange = (event) => {
                    const target = event.target;
                    const targetPath = target.getAttribute("setting-path").split(/\s/g);
                    const currentValue = getSetting(settings, targetPath);
                    if (target.checked) currentValue.push(target.value);
                    else currentValue.splice(currentValue.indexOf(target.value), 1);
                    saveOption(settings, targetPath, currentValue);
                };
                break;
            case "radio":
                element.checked = settingItemValue === element.value;
                element.onchange = (event) => {
                    const target = event.target;
                    if (target.checked) {
                        saveOption(settings, target.getAttribute("setting-path").split(/\s/g), target.value);
                    }
                };
                break;
            case "switch":
                element.checked = settingItemValue;
                element.onchange = (event) => {
                    const target = event.target;
                    saveOption(settings, target.getAttribute("setting-path").split(/\s/g), target.checked);
                };
                break;
            case "select":
                element.value = settingItemValue;
                element.onchange = (event) => {
                    const target = event.target;
                    saveOption(
                        settings,
                        target.getAttribute("setting-path").split(/\s/g),
                        target.options[target.selectedIndex].value
                    );
                };
                break;
            case "text":
                element.value = settingItemValue || "";
                element.oninput = (event) => {
                    const target = event.target;
                    saveOption(settings, target.getAttribute("setting-path").split(/\s/g), target.value);
                };
                break;
            default:
                break;
        }
    }

    if (serviceSelect) {
        serviceSelect.value = settings.TranslationService === "gemini" ? "gemini" : "siliconflow";
        serviceSelect.onchange = () => {
            const provider = currentProvider();
            const defaultModel = PROVIDER_MODELS[provider][0];

            settings.TranslationService = provider;
            settings.AIModel = defaultModel;
            settings.CustomModel = false;

            if (customModelCheckbox) customModelCheckbox.checked = false;
            populateModels(provider, defaultModel);

            chrome.storage.sync.set({
                TranslationService: provider,
                AIModel: defaultModel,
                CustomModel: false,
            });

            syncProviderUi();
        };
    }

    if (customModelCheckbox) {
        customModelCheckbox.addEventListener("change", syncCustomModelVisibility);
    }

    if (aiModelInput) {
        aiModelInput.addEventListener("input", () => {
            if (customModelCheckbox && customModelCheckbox.checked && aiModelInput.value.trim()) {
                saveOption(settings, ["AIModel"], aiModelInput.value.trim());
            }
        });
    }

    if (apiKeyInput) {
        let saveTimer = null;
        apiKeyInput.addEventListener("input", () => {
            if (saveTimer) clearTimeout(saveTimer);
            saveTimer = setTimeout(async () => {
                const provider = currentProvider();
                const key = apiKeyInput.value || "";
                localSecrets.ProviderSecrets[provider] = key.trim();
                await setProviderSecret(provider, key);
            }, 250);
        });
    }

    syncProviderUi();
};

function getSetting(localSettings, settingItemPath) {
    let result = localSettings;
    settingItemPath.forEach((key) => {
        result = result[key];
    });
    return result;
}

function saveOption(localSettings, settingItemPath, value) {
    let pointer = localSettings;
    for (let i = 0; i < settingItemPath.length - 1; i++) {
        pointer = pointer[settingItemPath[i]];
    }
    pointer[settingItemPath[settingItemPath.length - 1]] = value;

    const result = {};
    result[settingItemPath[0]] = localSettings[settingItemPath[0]];
    chrome.storage.sync.set(result);
}
