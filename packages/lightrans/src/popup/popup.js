import { LANGUAGES } from "@lightrans/translators";
import Channel from "common/scripts/channel.js";
import { i18nHTML } from "common/scripts/common.js";
import { DEFAULT_SETTINGS, getOrSetDefaultSettings } from "common/scripts/settings.js";

const PROVIDER_MODELS = {
    siliconflow: [
        "tencent/Hunyuan-MT-7B",
        "THUDM/GLM-4-9B-0414",
        "Qwen/Qwen3.5-4B",
    ],
    gemini: [
        "gemini-3.7-flash",
        "gemini-3.5-flash-lite",
        "gemini-3.5-flash",
    ],
};

const channel = new Channel();

let sourceLanguage = document.getElementById("sl");
let targetLanguage = document.getElementById("tl");
let exchangeButton = document.getElementById("exchange");
let providerSelect = document.getElementById("provider");
let modelSelect = document.getElementById("model");
let providerSettingsPending = Promise.resolve();

window.onload = async function () {
    i18nHTML();

    sourceLanguage.onchange = function () {
        judgeValue(exchangeButton, sourceLanguage);
        updateLanguageSetting(sourceLanguage.value, targetLanguage.value);
        showSourceTarget();
    };

    targetLanguage.onchange = function () {
        updateLanguageSetting(sourceLanguage.value, targetLanguage.value);
        showSourceTarget();
    };

    exchangeButton.onclick = exchangeLanguage;

    const settings = await getOrSetDefaultSettings(
        ["languageSetting", "TranslationService", "AIModel"],
        DEFAULT_SETTINGS
    );
    const popupStored = await getSyncStorage(["popupLanguageSetting"]);
    const languageSetting = popupStored.popupLanguageSetting || settings.languageSetting;

    for (let language in LANGUAGES) {
        const value = language;
        const name = chrome.i18n.getMessage(LANGUAGES[language]);

        sourceLanguage.options.add(
            new Option(name, value, languageSetting && value === languageSetting.sl, languageSetting && value === languageSetting.sl)
        );
        targetLanguage.options.add(
            new Option(name, value, languageSetting && value === languageSetting.tl, languageSetting && value === languageSetting.tl)
        );
    }

    const provider = settings.TranslationService === "gemini" ? "gemini" : "siliconflow";
    providerSelect.value = provider;
    populateModels(provider, settings.AIModel);

    providerSelect.onchange = () => {
        const selectedProvider = providerSelect.value === "gemini" ? "gemini" : "siliconflow";
        const defaultModel = PROVIDER_MODELS[selectedProvider][0];
        populateModels(selectedProvider, defaultModel);
        saveProviderAndModel(selectedProvider, defaultModel);
    };

    modelSelect.onchange = () => {
        saveProviderAndModel(providerSelect.value, modelSelect.value);
    };

    showSourceTarget();
    judgeValue(exchangeButton, sourceLanguage);
    addEventListener();
};

function getSyncStorage(keys) {
    return new Promise((resolve) => chrome.storage.sync.get(keys, resolve));
}

function populateModels(provider, selectedModel) {
    const models = PROVIDER_MODELS[provider] || PROVIDER_MODELS.siliconflow;
    modelSelect.innerHTML = "";
    for (const model of models) {
        modelSelect.options.add(new Option(model, model));
    }
    modelSelect.value = models.includes(selectedModel) ? selectedModel : models[0];
}

function saveProviderAndModel(provider, model) {
    providerSettingsPending = new Promise((resolve) => {
        chrome.storage.sync.set(
            {
                TranslationService: provider,
                AIModel: model,
                CustomModel: false,
            },
            () => setTimeout(resolve, 80)
        );
    });
    return providerSettingsPending;
}

chrome.commands.onCommand.addListener((command) => {
    if (command === "exchange_source_target_lang") {
        exchangeLanguage();
    }
});

function updateLanguageSetting(source, target) {
    saveOption("popupLanguageSetting", { sl: source, tl: target });
}

function saveOption(key, value) {
    const item = {};
    item[key] = value;
    chrome.storage.sync.set(item);
}

function addEventListener() {
    document.getElementById("translateSubmit").addEventListener("click", translateSubmit);
    document.addEventListener("keypress", translatePreSubmit);
}

function friendlyTranslateError(message) {
    if (/SiliconFlow.*\b402\b|status code 402/i.test(message)) {
        return "SiliconFlow 返回 402：账户状态阻止 API 调用。请检查 SiliconFlow 实名认证、余额/欠费状态；Hunyuan-MT-7B 本身当前仍是免费模型。";
    }
    if (/\b401\b|invalid.*key|api key.*invalid/i.test(message)) {
        return "API Key 未通过认证（401）。请检查当前 Provider 对应的 Key 是否填写正确。";
    }
    if (/\b403\b|permission|forbidden/i.test(message)) {
        return `Provider 拒绝访问（403）：${message}`;
    }
    if (/transient|429|rate\s*limit|status code 5\d{2}/i.test(message)) {
        return chrome.i18n.getMessage("MODEL_BUSY") || "该模型负载高，请使用其它模型或稍后重试。";
    }
    if (/timeout|超时|network|NET_ERR|ECONN|failed to fetch|abort/i.test(message)) {
        return `网络请求失败：${message}`;
    }
    return `翻译失败：${message}`;
}

async function translateSubmit() {
    const content = document.getElementById("translate_input").value;
    if (content.replace(/\s*/, "") === "") {
        document.getElementById("hint_message").style.display = "inline";
        return;
    }

    document.getElementById("hint_message").style.display = "none";
    const resultDiv = document.getElementById("translated-text");
    resultDiv.textContent = "翻译中...";

    try {
        await providerSettingsPending;
        const result = await channel.request("translate_in_popup", {
            text: content,
            sl: sourceLanguage.value,
            tl: targetLanguage.value,
        });

        if (result && result.__serviceError) {
            resultDiv.textContent = friendlyTranslateError(result.__serviceError);
        } else if (result && result.mainMeaning) {
            resultDiv.textContent = result.mainMeaning;
        } else {
            resultDiv.textContent = "翻译失败：Provider 未返回译文。";
        }
    } catch (error) {
        resultDiv.textContent = friendlyTranslateError(String((error && error.message) || error));
    }
}

function judgeValue(button, source) {
    button.style.color = source.value === "auto" ? "gray" : "#4a8cf7";
}

function exchangeLanguage() {
    if (sourceLanguage.value === "auto") return;
    const tempValue = targetLanguage.value;
    targetLanguage.value = sourceLanguage.value;
    sourceLanguage.value = tempValue;
    updateLanguageSetting(sourceLanguage.value, targetLanguage.value);
    showSourceTarget();
}

function translatePreSubmit(event) {
    const keycode = event.charCode || event.keyCode;
    if (keycode === 13) {
        translateSubmit();
    }
}

function showSourceTarget() {
    const inputElement = document.getElementById("translate_input");
    const sourceLanguageString = sourceLanguage.options[sourceLanguage.selectedIndex].text;
    const targetLanguageString = targetLanguage.options[targetLanguage.selectedIndex].text;
    inputElement.placeholder = `${sourceLanguageString} ==> ${targetLanguageString}`;
}
