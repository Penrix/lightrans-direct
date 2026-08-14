import { AITranslator } from "@lightrans/translators";
import { log } from "common/scripts/common.js";
import { promiseTabs, delayPromise } from "common/scripts/promise.js";
import { DEFAULT_SETTINGS, getOrSetDefaultSettings } from "common/scripts/settings.js";
import LocalTTS from "./local_tts.js";

class TranslatorManager {
    /**
     * @param {import("../../common/scripts/channel.js").default} channel Communication channel.
     */
    constructor(channel) {
        /**
         * @type {import("../../common/scripts/channel.js").default} Communication channel.
         */
        this.channel = channel;

        /**
         * @type {Promise<Void>} Initialize configurations.
         */
        this.config_loader = getOrSetDefaultSettings(
            ["languageSetting", "OtherSettings", "AIModel", "ApiKey", "TranslationService", "CustomModel", "CustomModelName"],
            DEFAULT_SETTINGS
        ).then((configs) => {
            // Init AI translator.
            this.AI_TRANSLATOR = new AITranslator();

            // Supported translators.
            this.TRANSLATORS = {
                AITrans: this.AI_TRANSLATOR,
            };

            // Translation language settings.
            this.LANGUAGE_SETTING = configs.languageSetting;

            // Other settings.
            this.OTHER_SETTINGS = configs.OtherSettings;

            // The default translator to use.
            this.DEFAULT_TRANSLATOR = "AITrans";

            // 服务模式与自定义模型相关状态
            this.SERVICE_MODE = configs.TranslationService || "free";
            this.CUSTOM_MODEL = !!configs.CustomModel;
            this.CUSTOM_MODEL_NAME = configs.CustomModelName || "";
            this.AI_MODEL = configs.AIModel;

            // 计算有效模型：自定义模式且勾选了自定义模型时，使用用户手填的模型名。
            // 兜底：免费模式或非自定义时若 AIModel 缺失，回退到预设模型首个，避免空模型被后续 setCurrentModel 静默 no-op。
            const fallbackModel = this.AI_TRANSLATOR.getAvailableModels()[0];
            const effectiveModel = (this.SERVICE_MODE === "custom" && this.CUSTOM_MODEL && this.CUSTOM_MODEL_NAME)
                ? this.CUSTOM_MODEL_NAME
                : (this.AI_MODEL || fallbackModel);

            // 设置模型、服务模式与 API Key
            this.AI_TRANSLATOR.setCurrentModel(effectiveModel);
            this.AI_TRANSLATOR.setServiceMode(this.SERVICE_MODE);
            this.AI_TRANSLATOR.setApiKey(configs.ApiKey || "");

            // 在配置加载完成后更新菜单
            this.updateTranslatePageMenu();
        });

        /**
         * Default TTS speed.
         */
        this.TTS_SPEED = "fast";

        /**
         * Local TTS service.
         */
        this.localTTS = new LocalTTS();

        /**
         * Start to provide services and listen to event.
         */
        this.provideServices();
        this.listenToEvents();
    }

    /**
     * Register service providers.
     *
     * This should be called for only once!
     */
    provideServices() {
        // Translate service for page popup.
        this.channel.provide("translate_in_popup", async (params) => {
            // Ensure that configurations have been initialized.
            await this.config_loader;
            
            let { text, sl, tl } = params;
            
            try {
                // 处理互译模式
                if (this.OTHER_SETTINGS.MutualTranslate) {
                    // 如果源语言是自动检测，先检测语言
                    if (sl === "auto") {
                        sl = await this.AI_TRANSLATOR.detect(text);
                        console.log('Popup detected source language:', sl);
                    }
                    
                    console.log('Popup current sl:', sl, 'current tl:', tl);
                    console.log('Popup MutualTranslate:', this.OTHER_SETTINGS.MutualTranslate);
                    
                    // 互译模式：根据检测到的源语言动态切换目标语言
                    if (sl === "zh-CN" || sl === "zh-TW") {
                        // 如果源语言是中文，目标语言切换为英文
                        tl = "en";
                        console.log('Popup switching to English, tl:', tl);
                    } else if (sl === "en") {
                        // 如果源语言是英文，目标语言切换为中文
                        tl = this.LANGUAGE_SETTING.tl;
                        console.log('Popup switching to Chinese, tl:', tl);
                    } else {
                        // 其他语言保持原有目标语言
                        console.log('Popup keeping original target language, tl:', tl);
                    }
                }
                
                console.log('Popup final translation languages - sl:', sl, 'tl:', tl);
                let result = await this.AI_TRANSLATOR.translate(text, sl, tl);
                return result;
            } catch (error) {
                throw error;
            }
        });

        // Translate service for selection.
        this.channel.provide("translate", async (params) => {
            // Ensure that configurations have been initialized.
            await this.config_loader;
            return this.translate(params.text, params.position);
        });

        // Pronounce service.
        this.channel.provide("pronounce", async (params) => {
            // Ensure that configurations have been initialized.
            await this.config_loader;
            
            let speed = params.speed;
            if (!speed) {
                speed = this.TTS_SPEED;
                this.TTS_SPEED = speed === "fast" ? "slow" : "fast";
            }

            return this.pronounce(params.pronouncing, params.text, params.language, speed);
        });

        // Get available AI models service.
        this.channel.provide("get_available_ai_models", () =>
            Promise.resolve(this.getAvailableAIModels())
        );
        
        // Update AI model service.
        this.channel.provide("update_ai_model", (detail) =>
            this.updateAIModel(detail.model)
        );
        
        // 配置加载完成后已经在构造函数中更新了菜单，无需重复调用
    }

    /**
     * Register event listeners.
     *
     * This should be called for only once!
     */
    listenToEvents() {
        // Result frame closed event.
        this.channel.on("frame_closed", this.stopPronounce.bind(this));

        /**
         * Update config cache on config changed.
         */
        chrome.storage.onChanged.addListener(
            (async (changes, area) => {
                if (area === "sync") {
                    // Ensure that configurations have been initialized.
                    await this.config_loader;

                    if (changes["languageSetting"]) {
                        this.LANGUAGE_SETTING = changes["languageSetting"].newValue;
                    }
                    
                    if (changes["OtherSettings"]) {
                        this.OTHER_SETTINGS = changes["OtherSettings"].newValue;
                    }
                    
                    if (changes["AIModel"]) {
                        this.AI_MODEL = changes["AIModel"].newValue;
                    }

                    if (changes["TranslationService"]) {
                        this.SERVICE_MODE = changes["TranslationService"].newValue || "free";
                        // Update the translation service mode for the translator.
                        this.AI_TRANSLATOR.setServiceMode(this.SERVICE_MODE);
                    }

                    if (changes["CustomModel"]) {
                        this.CUSTOM_MODEL = !!changes["CustomModel"].newValue;
                    }

                    if (changes["CustomModelName"]) {
                        this.CUSTOM_MODEL_NAME = changes["CustomModelName"].newValue || "";
                    }

                    if (changes["ApiKey"]) {
                        // Update the api key for the translator (custom mode only).
                        this.AI_TRANSLATOR.setApiKey(changes["ApiKey"].newValue || "");
                    }

                    // 任一影响有效模型的因素变化，重新计算并设置
                    if (changes["AIModel"] || changes["TranslationService"] || changes["CustomModel"] || changes["CustomModelName"]) {
                        const fallbackModel = this.AI_TRANSLATOR.getAvailableModels()[0];
                        const effectiveModel = (this.SERVICE_MODE === "custom" && this.CUSTOM_MODEL && this.CUSTOM_MODEL_NAME)
                            ? this.CUSTOM_MODEL_NAME
                            : (this.AI_MODEL || fallbackModel);
                        this.AI_TRANSLATOR.setCurrentModel(effectiveModel);
                    }
                }
            }).bind(this)
        );
    }

    /**
     * get the id of the current tab
     * if the current tab can't display the result panel
     * open a notice page to display the result and explain why the page shows
     * @returns the tab id. If tabId===-1, the user is setting the file URLs access permission and nothing should be done.
     */
    async getCurrentTabId() {
        let tabId = -1;
        const tabs = await promiseTabs.query({ active: true, currentWindow: true });
        tabId = tabs[0].id;

        // to test whether the current tab can receive message(display results)
        await this.channel.requestToTab(tabId, "check_availability").catch(async () => {
            const shouldOpenNoticePage = await new Promise((resolve) => {
                // The page is a local file page
                if (/^file:\/\.*/.test(tabs[0].url)) {
                    chrome.extension.isAllowedFileSchemeAccess((allowed) => {
                        if (!allowed && confirm(chrome.i18n.getMessage("PermissionRemind"))) {
                            chrome.tabs.create({
                                url: `chrome://extensions/?id=${chrome.runtime.id}`,
                            });
                            resolve(false);
                        } else resolve(true);
                    });
                } else resolve(true);
            });
            if (!shouldOpenNoticePage) {
                tabId = -1;
                return;
            }
            /**
             * the current tab can't display the result panel
             * so we open a notice page to display the result and explain why this page shows
             */
            const noticePageUrl = chrome.runtime.getURL("content/notice/notice.html");
            // get the tab id of an existing notice page
            try {
                const tab = (await promiseTabs.query({ url: noticePageUrl }))[0];
                // jump to the existed page
                chrome.tabs.highlight({
                    tabs: tab.index,
                });
                tabId = tab.id;
            } catch (error) {
                // create a new notice page
                const tab = await promiseTabs.create({
                    url: noticePageUrl,
                    active: true,
                });
                // wait for browser to open a new page
                await delayPromise(200);
                tabId = tab.id;
            }
        });
        return tabId;
    }

    /**
     *
     * 检测给定文本的语言。
     *
     * @param {string} text 需要检测的文本
     *
     * @returns {Promise<String>} detected language Promise
     */
    async detect(text) {
        // Ensure that configurations have been initialized.
        await this.config_loader;

        return this.AI_TRANSLATOR.detect(text);
    }

    /**
     *
     * This is a translation client function
     * 1. get language settings
     * 2. if source language is "auto", use normal translation mode
     * 3. else use mutual translation mode(auto translate from both sides)
     * 4. send request, get result
     *
     * @param {String} text original text to be translated
     * @param {Array<Number>} position position of the text
     * @param {Number} selectionHeight height of the selected text
     *
     * @returns {Promise<void>} translate finished Promise
     */
    async translate(text, position, selectionHeight = 0) {
        // Ensure that configurations have been initialized.
        await this.config_loader;

        // get current tab id
        const currentTabId = await this.getCurrentTabId();
        if (currentTabId === -1) return;

        /**
         * Get current time as timestamp.
         *
         * Timestamp is used for preventing disordered translating message to disturb user.
         *
         * Every translating request has a unique timestamp and every message from that translating
         * request will be assigned with the timestamp. About usage of the timestamp, please refer
         * to display.js.
         */
        let timestamp = new Date().getTime();

        // Inform current tab translating started.
        this.channel.emitToTabs(currentTabId, "start_translating", {
            text,
            position,
            selectionHeight,
            timestamp,
        });

        let sl = this.LANGUAGE_SETTING.sl,
            tl = this.LANGUAGE_SETTING.tl;
        let originalTl = tl;

        try {
            // 处理互译模式
            if (this.OTHER_SETTINGS.MutualTranslate) {
                // 如果源语言是自动检测，先检测语言
                if (sl === "auto") {
                    sl = await this.AI_TRANSLATOR.detect(text);
                    console.log('Detected source language:', sl);
                }
                
                console.log('Current sl:', sl, 'current tl:', tl);
                console.log('MutualTranslate:', this.OTHER_SETTINGS.MutualTranslate);
                
                // 互译模式：根据检测到的源语言动态切换目标语言
                if (sl === "zh-CN" || sl === "zh-TW") {
                    // 如果源语言是中文，目标语言切换为英文
                    tl = "en";
                    console.log('Switching to English, tl:', tl);
                } else if (sl === "en") {
                    // 如果源语言是英文，目标语言切换为中文
                    tl = this.LANGUAGE_SETTING.tl;
                    console.log('Switching to Chinese, tl:', tl);
                } else {
                    // 其他语言保持原有目标语言
                    console.log('Keeping original target language, tl:', tl);
                }
            }

            console.log('Final translation languages - sl:', sl, 'tl:', tl);
            // Do translate.
            let result = await this.AI_TRANSLATOR.translate(text, sl, tl);
            result.sourceLanguage = sl;
            result.targetLanguage = tl;

            // Send translating result to current tab.
            this.channel.emitToTabs(currentTabId, "translating_finished", {
                timestamp,
                ...result,
            });
        } catch (error) {
            // Inform current tab translating failed.
            this.channel.emitToTabs(currentTabId, "translating_error", {
                error,
                timestamp,
            });
        }
    }

    /**
     * Text to speech proxy.
     *
     * @param {String} pronouncing which text are we pronouncing? enum{source, target}
     * @param {String} text The text.
     * @param {String} language The language of the text.
     * @param {String} speed The speed of the speech.
     *
     * @returns {Promise<void>} pronounce finished Promise
     */
    async pronounce(pronouncing, text, language, speed) {
        // Ensure that configurations have been initialized.
        await this.config_loader;

        // get current tab id
        const currentTabId = await this.getCurrentTabId();
        if (currentTabId === -1) return;

        let lang = language;
        let timestamp = new Date().getTime();

        // Inform current tab pronouncing started.
        this.channel.emitToTabs(currentTabId, "start_pronouncing", {
            pronouncing,
            text,
            language,
            timestamp,
        });

        try {
            if (language === "auto") {
                lang = await this.AI_TRANSLATOR.detect(text);
            }

            await this.AI_TRANSLATOR.pronounce(text, lang, speed).catch(
                ((error) => {
                    // API pronouncing failed, try local TTS service.
                    if (!this.localTTS.speak(text, lang, speed)) {
                        throw error;
                    }
                }).bind(this)
            );

            // Inform current tab pronouncing finished.
            this.channel.emitToTabs(currentTabId, "pronouncing_finished", {
                pronouncing,
                text,
                language,
                timestamp,
            });
        } catch (error) {
            // Inform current tab pronouncing failed.
            this.channel.emitToTabs(currentTabId, "pronouncing_error", {
                pronouncing,
                error,
                timestamp,
            });
        }
    }

    /**
     * Stop pronounce proxy.
     */
    async stopPronounce() {
        // Ensure that configurations have been initialized.
        await this.config_loader;

        this.AI_TRANSLATOR.stopPronounce();
        this.localTTS.pause();
    }

    /**
     * Get available AI models.
     *
     * @returns {Array<string>} available AI models.
     */
    getAvailableAIModels() {
        return this.AI_TRANSLATOR.getAvailableModels();
    }
    
    /**
     * Update AI model.
     *
     * @param {string} model the new AI model to use.
     *
     * @returns {Promise<void>} update finished promise.
     */
    updateAIModel(model) {
        return new Promise((resolve) => {
            chrome.storage.sync.set({ AIModel: model }, () => {
                resolve();
            });
        });
    }
    
    /**
     * Update the translate page context menu with available AI models.
     */
    updateTranslatePageMenu() {
        // 获取可用的AI模型列表
        const availableModels = this.getAvailableAIModels();
        
        // 确保 chrome.contextMenus 可用时才创建菜单
        if (chrome.contextMenus) {
            // 先移除旧菜单，避免重复创建
            try {
                chrome.contextMenus.removeAll(() => {
                    // 移除所有菜单后重新创建
                    // 重新创建选择翻译菜单
                    chrome.contextMenus.create({
                        id: "translate",
                        title: `${chrome.i18n.getMessage("Translate")} '%s'`,
                        contexts: ["selection"],
                    });

                    // Add an entry to options page for Firefox as it doesn't have one.
                    if (BROWSER_ENV === "firefox") {
                        chrome.contextMenus.create({
                            id: "settings",
                            title: chrome.i18n.getMessage("Settings"),
                            contexts: ["action"],
                        });
                    }

                    // 创建快捷键设置菜单
                    chrome.contextMenus.create({
                        id: "shortcut",
                        title: chrome.i18n.getMessage("ShortcutSetting"),
                        contexts: ["action"],
                    });

                    // 创建黑名单相关菜单
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
                    
                    // 创建翻译此页主菜单
                    chrome.contextMenus.create({
                        id: "translate_page",
                        title: chrome.i18n.getMessage("TranslatePage"),
                        contexts: ["page"],
                        enabled: true,
                    });
                    
                    // 创建模型子菜单
                    availableModels.forEach(model => {
                        chrome.contextMenus.create({
                            id: `translate_page_${model}`,
                            title: model,
                            parentId: "translate_page",
                            contexts: ["page"],
                        });
                    });
                });
            } catch (error) {
                console.error('lightrans: Error updating translate page menu:', error);
            }
        }
    }
}

/**
 * 使用指定的AI模型翻译当前网页。
 *
 * @param {import("../../common/scripts/channel.js").default} channel Communication channel.
 * @param {string} [model] The AI model to use for translation. If not provided, uses the default model.
 */
function translatePage(channel, model) {
    console.log('lightrans: translatePage function called with model:', model);
    // 读取页面翻译显示模式偏好（原文/译文/对照），决定整页翻译默认行为
    getOrSetDefaultSettings().then((allSettings) => {
        const pageModeParam = (allSettings && allSettings.PageTranslationDisplayMode) || "translated";
        // 获取当前标签页
        promiseTabs.query({ active: true, currentWindow: true }).then((tabs) => {
        const tabId = tabs[0].id;
        console.log('lightrans: Current tab id:', tabId);
        
        // 注入网页翻译脚本，使用Function构造函数安全传递参数
        const modelParam = model || "default";
        
        // 使用 chrome.scripting.executeScript 注入脚本（MV3 已移除 chrome.tabs.executeScript）
        // 把原内联脚本重构成可序列化的函数，通过 args 传入 pageMode 与 model
        const injectPageTranslate = (pageMode, model) => {
            console.log('lightrans: Page translate script injected');

            // 页面翻译显示模式：original(原文) / translated(译文) / bilingual(对照)

            // 检查document.body是否存在
            if (!document.body) {
                        console.error('lightrans: document.body is not available');
                        return;
                    }

                    // 页面翻译工具条的标题元素引用（翻译完成时更新）
                    let bannerTitleEl = null;

                    // 对照模式下插入的译文 span 集合，便于切换模式时移除
                    const insertedSpans = [];
                    
                    // 存储原始文本内容，用于翻译和恢复
                    window.edgeTranslateOriginalTextNodes = [];
                    
                    // 获取网页中所有文本节点
                    function getAllTextNodes(root) {
                        const textNodes = [];
                        try {
                            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
                                acceptNode: function(node) {
                                    // 过滤掉空文本节点和特定元素内的文本
                                    if (node.nodeValue.trim() && !node.parentNode.closest('script, style, noscript, iframe, svg, canvas, input, textarea, select, img, picture, video, audio, embed, object')) {
                                        return NodeFilter.FILTER_ACCEPT;
                                    }
                                    return NodeFilter.FILTER_SKIP;
                                }
                            }, false);
                            let node;
                            while ((node = walker.nextNode())) {
                                textNodes.push(node);
                                // 存储原始文本内容
                                window.edgeTranslateOriginalTextNodes.push({
                                    node: node,
                                    originalText: node.nodeValue
                                });
                            }
                        } catch (error) {
                            console.error('lightrans: Error in getAllTextNodes:', error);
                        }
                        return textNodes;
                    }
                    
                    // 获取网页内容
                    const textNodes = getAllTextNodes(document.body);
                    console.log('lightrans: Found text nodes:', textNodes.length);
                    
                    // 收集所有需要翻译的文本
                    const allTexts = [];
                    const textIndices = []; // 记录原始索引与收集的文本索引的映射
                    const textMap = new Map(); // 用于去重
                    
                    textNodes.forEach((node, index) => {
                        const text = node.nodeValue;
                        // 翻译所有非空文本，去掉长度限制
                        if (text.trim()) {
                            if (!textMap.has(text)) {
                                textMap.set(text, allTexts.length);
                                allTexts.push(text);
                            }
                            textIndices.push(textMap.get(text));
                        } else {
                            textIndices.push(-1); // 表示不需要翻译
                        }
                    });
                    
                    console.log('lightrans: Total texts to translate:', allTexts.length);
                    
                    // 并行翻译参数设置
                    const maxBatchSize = 500; // 每批次最多500个字符
                    const maxParallelBatches = 3; // 最多并行3个批次
                    const translatedTexts = new Array(allTexts.length);
                    let totalTranslated = 0;
                    let totalReplaced = 0;
                    let batchesSent = 0;
                    let batchesCompleted = 0;
                    const totalBatches = Math.ceil(allTexts.length / maxBatchSize);
                    
                    // 替换已翻译的文本节点
                    function replaceTranslatedNodes() {
                        let replacedCount = 0;

                        // 替换所有已翻译的文本节点
                        textNodes.forEach((node, index) => {
                            const textIndex = textIndices[index];
                            if (textIndex >= 0 && translatedTexts[textIndex]) {
                                // 始终缓存译文，供后续切换显示模式使用
                                if (window.edgeTranslateOriginalTextNodes && window.edgeTranslateOriginalTextNodes[index]) {
                                    window.edgeTranslateOriginalTextNodes[index].translatedText = translatedTexts[textIndex];
                                }
                                // 仅在「译文」模式下就地替换文本节点
                                if (pageMode === 'translated' && node.nodeValue !== translatedTexts[textIndex]) {
                                    node.nodeValue = translatedTexts[textIndex];
                                    replacedCount++;
                                    totalReplaced++;
                                }
                            }
                        });

                        if (replacedCount > 0) {
                            console.log('lightrans: Replaced', replacedCount, 'nodes in this update, total replaced:', totalReplaced);
                        }
                    }
                    
                    // 处理单个文本翻译结果
                    function handleTranslationResult(index, translatedText) {
                        translatedTexts[index] = translatedText;
                        totalTranslated++;
                        batchesCompleted++;
                        
                        // 每翻译10个文本替换一次，平衡性能和用户体验
                        if (totalTranslated % 10 === 0 || totalTranslated === allTexts.length) {
                            replaceTranslatedNodes();
                        }
                        
                        // 继续发送新的请求
                        sendParallelRequests();
                        
                        // 检查是否所有文本都已翻译完成
                        if (totalTranslated === allTexts.length) {
                            console.log('lightrans: All texts translated, total replaced:', totalReplaced, 'nodes');
                            if (bannerTitleEl) bannerTitleEl.textContent = 'Lightrans 已翻译此页';
                            applyMode(pageMode);
                        }
                    }
                    
                    // 发送翻译请求
                    function sendTranslationRequest(text, index) {
                        chrome.runtime.sendMessage({
                            type: 'TRANSLATE_PAGE_CONTENT',
                            content: {
                                texts: [text],
                                indices: textIndices,
                                index: index
                            },
                            model: model
                        }, (response) => {
                            console.log('lightrans: Translation response received for index', index);
                            
                            if (response && response.translatedContent) {
                                console.log('lightrans: Translation content received for index', index);
                                
                                try {
                                    // 直接使用翻译结果，无需JSON.parse
                                    const translatedText = response.translatedContent.texts[0];
                                    
                                    // 处理翻译结果
                                    handleTranslationResult(index, translatedText);
                                } catch (error) {
                                    console.error('lightrans: Error processing translation result for index', index, ':', error);
                                    // 翻译失败时保留原文
                                    handleTranslationResult(index, text);
                                }
                            } else if (response && response.error) {
                                console.error('lightrans: Translation error for index', index, ':', response.error);
                                // 翻译失败时保留原文
                                handleTranslationResult(index, text);
                            } else {
                                console.error('lightrans: No translated content in response for index', index);
                                // 翻译失败时保留原文
                                handleTranslationResult(index, text);
                            }
                        });
                    }
                    
                    // 并行发送翻译请求
                    function sendParallelRequests() {
                        // 发送最多maxParallelBatches个请求
                        while (batchesSent < allTexts.length && batchesSent < batchesCompleted + maxParallelBatches) {
                            const text = allTexts[batchesSent];
                            const index = batchesSent;
                            
                            console.log('lightrans: Sending translation request for index', index, ':', text.length, 'characters');
                            sendTranslationRequest(text, index);
                            
                            batchesSent++;
                        }
                    }
                    
                    // 开始并行翻译
                    console.log('lightrans: Starting parallel translation, total texts:', allTexts.length);
                    sendParallelRequests();
                    
                    // 每500毫秒检查一次，继续发送请求
                    const interval = setInterval(() => {
                        if (batchesSent < allTexts.length) {
                            sendParallelRequests();
                        } else {
                            clearInterval(interval);
                        }
                    }, 500);

                    // 根据显示模式渲染页面：原文 / 译文 / 对照
                    function applyMode(mode) {
                        const originals = window.edgeTranslateOriginalTextNodes || [];
                        // 先清除已插入的对照译文 span
                        insertedSpans.forEach((sp) => {
                            if (sp.parentNode) sp.parentNode.removeChild(sp);
                        });
                        insertedSpans.length = 0;

                        if (mode === 'bilingual') {
                            originals.forEach((item) => {
                                const node = item && item.node;
                                if (!node) return;
                                node.nodeValue = item.originalText;
                                if (item.translatedText) {
                                    const span = document.createElement('span');
                                    span.className = 'lightrans-bilingual';
                                    span.textContent = item.translatedText;
                                    span.style.cssText = 'display:block;margin:2px 0 6px;padding:2px 6px;background:#f5f7fa;border-left:3px solid #2f6bff;color:#3a4252;font-size:0.92em;line-height:1.5;border-radius:4px;';
                                    if (node.parentNode) {
                                        node.parentNode.insertBefore(span, node.nextSibling);
                                        insertedSpans.push(span);
                                    }
                                }
                            });
                        } else if (mode === 'original') {
                            originals.forEach((item) => {
                                if (item && item.node && item.originalText !== undefined) {
                                    item.node.nodeValue = item.originalText;
                                }
                            });
                        } else {
                            // translated
                            originals.forEach((item) => {
                                if (item && item.node && item.translatedText) {
                                    item.node.nodeValue = item.translatedText;
                                }
                            });
                        }
                    }

                    // 创建页面翻译工具条：显示原网页 / 显示译文 / 对照 / 关闭
                    function createBanner() {
                        if (document.getElementById('lightrans-page-banner')) return;
                        const banner = document.createElement('div');
                        banner.id = 'lightrans-page-banner';
                        banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;display:flex;align-items:center;gap:10px;height:40px;padding:0 14px;background:#ffffff;color:#1f2430;font:14px/1 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;box-shadow:0 1px 6px rgba(0,0,0,0.18);box-sizing:border-box;';

                        const title = document.createElement('span');
                        title.textContent = 'Lightrans 翻译中…';
                        title.style.cssText = 'font-weight:600;white-space:nowrap;';
                        banner.appendChild(title);
                        bannerTitleEl = title;

                        const spacer = document.createElement('span');
                        spacer.style.cssText = 'flex:1;';
                        banner.appendChild(spacer);

                        function makeBtn(label) {
                            const b = document.createElement('button');
                            b.textContent = label;
                            b.style.cssText = 'cursor:pointer;border:1px solid #d0d5dd;background:#f5f7fa;color:#1f2430;border-radius:6px;padding:5px 10px;font:13px/1 system-ui,sans-serif;';
                            b.onmouseenter = () => { b.style.background = '#e9edf2'; };
                            b.onmouseleave = () => { b.style.background = '#f5f7fa'; };
                            return b;
                        }

                        const btnOriginal = makeBtn('显示原网页');
                        const btnTrans = makeBtn('显示译文');
                        const btnBilingual = makeBtn('对照');
                        const btnClose = makeBtn('✕');
                        btnClose.style.cssText += 'font-size:15px;line-height:1;padding:3px 9px;';

                        banner.appendChild(btnOriginal);
                        banner.appendChild(btnTrans);
                        banner.appendChild(btnBilingual);
                        banner.appendChild(btnClose);
                        document.body.appendChild(banner);

                        // 将页面主体下移，避免被工具条遮挡
                        document.body.style.marginTop = '40px';

                        btnOriginal.addEventListener('click', () => {
                            applyMode('original');
                        });

                        btnTrans.addEventListener('click', () => {
                            applyMode('translated');
                        });

                        btnBilingual.addEventListener('click', () => {
                            applyMode('bilingual');
                        });

                        btnClose.addEventListener('click', () => {
                            if (banner.parentNode) banner.parentNode.removeChild(banner);
                            document.body.style.marginTop = '';
                        });
                    }

                    createBanner();
                    if (allTexts.length === 0 && bannerTitleEl) {
                        bannerTitleEl.textContent = 'Lightrans 已翻译此页';
                    }
            };

            chrome.scripting.executeScript(
                { target: { tabId }, func: injectPageTranslate, args: [pageModeParam, modelParam] },
                (result) => {
            if (chrome.runtime.lastError) {
                log(`Chrome runtime error: ${chrome.runtime.lastError}`);
                log(`Detail: ${result}`);
                console.error('lightrans: executeScript error:', chrome.runtime.lastError);
            } else {
                console.log('lightrans: Script executed successfully, result:', result);
                channel.emitToTabs(tabId, "start_page_translate", { translator: "aitrans", model: model });
            }
        });
    });
    }).catch(error => {
        console.error('lightrans: Error in translatePage:', error);
    });
}

export { TranslatorManager, translatePage };
