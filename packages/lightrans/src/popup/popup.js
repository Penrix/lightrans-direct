import { LANGUAGES } from "@lightrans/translators";
import Channel from "common/scripts/channel.js";
import { i18nHTML } from "common/scripts/common.js";
import { DEFAULT_SETTINGS, getOrSetDefaultSettings } from "common/scripts/settings.js";

/**
 * Communication channel.
 */
const channel = new Channel();

// 获取下拉列表元素
let sourceLanguage = document.getElementById("sl");
let targetLanguage = document.getElementById("tl");
// 获取交换按钮
let exchangeButton = document.getElementById("exchange");
/**
 * 初始化设置列表
 */
window.onload = function () {
    i18nHTML();

    sourceLanguage.onchange = function () {
        // 如果源语言是自动判断语言类型(值是auto),则按钮显示灰色，避免用户点击,如果不是，则显示蓝色，可以点击
        judgeValue(exchangeButton, sourceLanguage);
        updateLanguageSetting(
            sourceLanguage.options[sourceLanguage.selectedIndex].value,
            targetLanguage.options[targetLanguage.selectedIndex].value
        );
        showSourceTarget(); // update source language and target language in input placeholder
    };

    targetLanguage.onchange = function () {
        updateLanguageSetting(
            sourceLanguage.options[sourceLanguage.selectedIndex].value,
            targetLanguage.options[targetLanguage.selectedIndex].value
        );
        showSourceTarget(); // update source language and target language in input placeholder
    };

    // 添加交换按钮对点击事件的监听
    exchangeButton.onclick = exchangeLanguage;

    // 获得用户之前选择的弹窗语言翻译选项
    getOrSetDefaultSettings(["popupLanguageSetting", "languageSetting"], DEFAULT_SETTINGS).then(
        (result) => {
            // 使用弹窗独立的语言设置，如果没有则使用全局设置作为默认值
            let languageSetting = result.popupLanguageSetting || result.languageSetting;

            // languages是可选的源语言和目标语言的列表
            for (let language in LANGUAGES) {
                let value = language;
                let name = chrome.i18n.getMessage(LANGUAGES[language]);

                if (languageSetting && value == languageSetting.sl) {
                    sourceLanguage.options.add(new Option(name, value, true, true));
                } else {
                    sourceLanguage.options.add(new Option(name, value));
                }

                if (languageSetting && value == languageSetting.tl) {
                    targetLanguage.options.add(new Option(name, value, true, true));
                } else {
                    targetLanguage.options.add(new Option(name, value));
                }
            }

            showSourceTarget(); // show source language and target language in input placeholder
        }
    );
    // 统一添加事件监听
    addEventListener();
};

/**
 * 监听快捷键
 */
chrome.commands.onCommand.addListener((command) => {
    switch (command) {
        case "exchange_source_target_lang":
            exchangeLanguage();
            break;
        default:
            break;
    }
});

/**
 * 保存弹窗翻译语言设定（仅用于弹窗，不影响划词翻译）
 *
 * @param {*} sourceLanguage 源语言
 * @param {*} targetLanguage 目标语言
 */
function updateLanguageSetting(sourceLanguage, targetLanguage) {
    // 只保存弹窗的语言设置，不发送消息给background影响全局设置
    saveOption("popupLanguageSetting", { sl: sourceLanguage, tl: targetLanguage });
}

/**
 * 保存一条设置项
 *
 * @param {*} key 设置项名
 * @param {*} value 设置项
 */
function saveOption(key, value) {
    let item = {};
    item[key] = value;
    chrome.storage.sync.set(item);
}

/**
 * 需要对页面中的元素添加事件监听时，请在此函数中添加
 */
function addEventListener() {
    document.getElementById("translateSubmit").addEventListener("click", translateSubmit);
    document.addEventListener("keypress", translatePreSubmit); // 对用户按下回车按键后的事件进行监听
}

/**
 * block start
 * 事件监听的回调函数定义请在此区域中进
 */

/**
 * 负责在弹窗中输入内容后进行翻译
 */
function translateSubmit() {
    let content = document.getElementById("translate_input").value;
    if (content.replace(/\s*/, "") !== "") {
        // 判断值是否为空
        document.getElementById("hint_message").style.display = "none";
        
        // 显示加载状态
        const resultDiv = document.getElementById("translated-text");
        resultDiv.innerHTML = "翻译中...";

        // 获取当前弹窗的语言设置
        const sl = sourceLanguage.value;
        const tl = targetLanguage.value;
        
        // 直接发送翻译请求，获取结果后显示在当前弹窗
        channel.request("translate_in_popup", { 
            text: content, 
            sl: sl, 
            tl: tl 
        }).then((result) => {
            if (result && result.mainMeaning) {
                resultDiv.innerHTML = result.mainMeaning;
            } else {
                resultDiv.innerHTML = "翻译失败，请重试";
            }
        }).catch((error) => {
            resultDiv.innerHTML = `翻译错误: ${error.message}`;
        });
    } // 提示输入的内容为空
    else document.getElementById("hint_message").style.display = "inline";
}

/**
 *
 * 如果源语言是自动判断语言类型(值是auto),则按钮显示灰色，避免用户点击
 *
 * @param {*HTMLElement} exchangeButton 特定的一个element,是一个交换按钮图
 * @param {*HTMLElement} sourceLanguage 特定的一个element,源语言的选项
 */
function judgeValue(exchangeButton, sourceLanguage) {
    if (sourceLanguage.value === "auto") exchangeButton.style.color = "gray";
    else exchangeButton.style.color = "#4a8cf7";
}

/**
 * 交换源语言和目标语言
 */
function exchangeLanguage() {
    if (sourceLanguage.value !== "auto") {
        let tempValue = targetLanguage.value;
        targetLanguage.value = sourceLanguage.value;
        sourceLanguage.value = tempValue;
        updateLanguageSetting(sourceLanguage.value, targetLanguage.value);
        showSourceTarget(); // update source language and target language in input placeholder
    }
}



/**
 * 判断如果按下的是按钮是enter键，就调用翻译的函数
 */
function translatePreSubmit(event) {
    let int_keycode = event.charCode || event.keyCode;
    if (int_keycode == "13") {
        translateSubmit();
    }
}

/**
 * show source language and target language hint in placeholder of input element
 */
function showSourceTarget() {
    let inputElement = document.getElementById("translate_input");
    let sourceLanguageString = sourceLanguage.options[sourceLanguage.selectedIndex].text;
    let targetLanguageString = targetLanguage.options[targetLanguage.selectedIndex].text;
    inputElement.placeholder = `${sourceLanguageString} ==> ${targetLanguageString}`;
}

/**
 * end block
 */
