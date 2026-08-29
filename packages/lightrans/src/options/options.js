import { i18nHTML } from "common/scripts/common.js";
import {
    DEFAULT_SETTINGS,
    getOrSetDefaultSettings,
    getOrSetLocalSecrets,
    setProviderSecret,
} from "common/scripts/settings.js";

const MODELS = [
    "THUDM/GLM-4-9B-0414",
    "tencent/Hunyuan-MT-7B",
    "Qwen/Qwen3.5-4B",
];

window.onload = async () => {
    i18nHTML();

    const settings = await getOrSetDefaultSettings(undefined, DEFAULT_SETTINGS);
    const localSecrets = await getOrSetLocalSecrets();

    const apiKeyInput = document.getElementById("api-key");
    const customModelCheckbox = document.getElementById("custom-model");
    const aiModelSelect = document.getElementById("ai-model");
    const aiModelInput = document.getElementById("ai-model-input");
    const glossaryText = document.getElementById("glossary-text");
    const glossaryStatus = document.getElementById("glossary-status");

    function populateModels(selectedModel) {
        if (!aiModelSelect) return;
        aiModelSelect.innerHTML = "";
        for (const model of MODELS) {
            const option = document.createElement("option");
            option.value = model;
            option.textContent = model;
            aiModelSelect.appendChild(option);
        }
        aiModelSelect.value = MODELS.includes(selectedModel) ? selectedModel : MODELS[0];
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

    function updateGlossaryStatus() {
        if (!glossaryStatus || !glossaryText) return;
        const count = glossaryText.value
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line && !line.startsWith("#") && (line.includes("=") || line.includes("=>")))
            .length;
        glossaryStatus.textContent = `已配置 ${count} 条固定术语。每次出现都会按右侧文本显示。`;
    }

    populateModels(settings.AIModel);

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
                element.checked = !!settingItemValue;
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
        apiKeyInput.value = localSecrets.ProviderSecrets.siliconflow || "";
        let saveTimer = null;
        apiKeyInput.addEventListener("input", () => {
            const key = apiKeyInput.value || "";
            if (saveTimer) clearTimeout(saveTimer);
            saveTimer = setTimeout(async () => {
                localSecrets.ProviderSecrets.siliconflow = key.trim();
                await setProviderSecret("siliconflow", key);
            }, 250);
        });
    }

    if (glossaryText) {
        glossaryText.value = settings.GlossaryText || "";
        updateGlossaryStatus();
        let glossaryTimer = null;
        glossaryText.addEventListener("input", () => {
            const value = glossaryText.value;
            updateGlossaryStatus();
            if (glossaryTimer) clearTimeout(glossaryTimer);
            glossaryTimer = setTimeout(() => {
                settings.GlossaryText = value;
                chrome.storage.sync.set({ GlossaryText: value });
            }, 250);
        });
    }

    // Provider selection was intentionally removed. Normalize old installs immediately.
    settings.TranslationService = "siliconflow";
    chrome.storage.sync.set({ TranslationService: "siliconflow" });
    syncCustomModelVisibility();
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
