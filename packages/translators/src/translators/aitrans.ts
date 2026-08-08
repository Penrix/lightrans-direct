import axios from "../axios";
import { TranslationResult } from "../types";

class AITranslator {
    /**
     * 共享中继令牌（仅用于区分「谁都能调」与「知道令牌才能调」，
     * 并非 SiliconFlow 密钥。会进入扩展 bundle，但能挡住随手白嫖）。
     * 必须与 EdgeOne 中继 edge-functions/api/translate.js 中的 RELAY_TOKEN 一致。
     */
    private readonly RELAY_TOKEN: string = "3bfca6f691946ca6391ef342411758747dfa6f481a04bfb4";

    /** 官方中继固定地址：官方模式强制使用，避免被设置页中可能残留的自定义地址覆盖。 */
    private readonly OFFICIAL_RELAY_ENDPOINT: string = "https://trans.hin.cool/api/translate";

    /**
     * 中继地址（由设置页 RelayEndpoint 注入）。
     * 默认使用官方中继，开箱即用、无需用户配置即可翻译。
     */
    private relayEndpoint: string = "https://trans.hin.cool/api/translate";

    /**
     * 翻译服务模式：
     * - "official"：官方中继（默认），使用内置共享令牌，零配置、无需 API Key；
     * - "custom"：自定义中继，使用用户自有 API Key（Bearer）鉴权，需用户自备中继服务。
     */
    private serviceMode: string = "official";

    /**
     * 自定义模式下的 SiliconFlow API Key（仅 custom 模式使用，由设置页注入）。
     */
    private apiKey: string = "";

    /**
     * Available translation models.
     */
    private availableModels: string[] = [
        "tencent/Hunyuan-MT-7B",
        "THUDM/GLM-4-9B-0414",
        "Qwen/Qwen3.5-4B"
    ];

    /**
     * Current model to use.
     */
    private currentModel: string = "Qwen/Qwen3.5-4B";

    /**
     * Detect language of given text.
     *
     * @param text text to detect
     *
     * @returns Promise of detected language
     */
    async detect(text: string): Promise<string> {
        // Simple heuristic to detect Chinese/English
        // Check if text contains Chinese characters
        if (/[\u4e00-\u9fa5]/.test(text)) {
            return "zh-CN";
        }
        // Check if text contains mostly English characters
        else if (/^[a-zA-Z0-9\s\p{Punctuation}]*$/u.test(text)) {
            return "en";
        }
        // For other languages, return auto
        return "auto";
    }

    /**
     * Translate text using AItrans with specified model.
     *
     * @param text text to translate
     * @param from source language
     * @param to target language
     *
     * @returns Promise of translation result
     */
    async translate(text: string, from: string, to: string): Promise<TranslationResult> {
        try {
            // 官方模式强制使用官方中继地址，忽视设置页中可能残留的自定义地址
            const endpoint = (this.serviceMode === "custom")
                ? this.relayEndpoint
                : this.OFFICIAL_RELAY_ENDPOINT;

            if (!endpoint) {
                throw new Error("未配置中继地址（RelayEndpoint），请在设置页填写你的中继 /api/translate 地址");
            }

            const headers: Record<string, string> = {
                "Content-Type": "application/json",
            };

            if (this.serviceMode === "custom") {
                // 自定义中继：使用用户自有 API Key 鉴权（Bearer）。
                if (!this.apiKey) {
                    throw new Error("自定义中继模式需要填写 API Key");
                }
                headers["Authorization"] = `Bearer ${this.apiKey}`;
            } else {
                // 官方中继：使用内置共享令牌，无需用户 Key。
                headers["X-Lightrans-Token"] = this.RELAY_TOKEN;
            }

            // 通过中继转发，SiliconFlow 密钥只存在于服务端，永不进入扩展。
            const response = await axios.post(endpoint, {
                text,
                from,
                to,
                model: this.currentModel
            }, {
                headers
            });

            // 中继返回 { translatedText }
            const translatedText = (response.data && response.data.translatedText || "").toString().trim();

            // Return the translation result
            return {
                originalText: text,
                mainMeaning: translatedText,
                tPronunciation: "",
                sPronunciation: "",
                detailedMeanings: [],
                definitions: [],
                examples: []
            };
        } catch (error) {
            console.error("AItrans translation error:", error);
            throw new Error("AItrans translation failed");
        }
    }

    /**
     * Pronounce text using AItrans.
     *
     * @param _text text to pronounce
     * @param _language language of text
     * @param _speed pronunciation speed
     *
     * @returns Promise of pronunciation finished
     */
    async pronounce(_text: string, _language: string, _speed: string): Promise<void> {
        // SiliconFlow API doesn't provide pronunciation, so we'll just resolve
        return Promise.resolve();
    }

    /**
     * Stop pronunciation.
     */
    stopPronounce(): void {
        // SiliconFlow API doesn't provide pronunciation, so this is a no-op
    }

    /**
     * Get supported languages.
     *
     * @returns Set of supported languages
     */
    supportedLanguages(): Set<string> {
        // SiliconFlow supports many languages, but we'll return a basic set
        return new Set([
            "auto",
            "en",
            "zh-CN",
            "zh-TW",
            "fr",
            "es",
            "ru",
            "de",
            "ja",
            "ko",
            "pt",
            "it",
            "ar",
            "hi",
            "tr",
            "pl",
            "nl",
            "sv",
            "fi",
            "da",
            "no",
            "cs",
            "hu",
            "ro",
            "sk",
            "bg",
            "uk",
            "th",
            "vi",
            "id",
            "ms",
            "tl",
            "fa",
            "ur",
            "bn",
            "pa",
            "gu",
            "kn",
            "ml",
            "ta",
            "te",
            "mr",
            "ne",
            "my",
            "km",
            "lo",
            "si",
            "am",
            "sw",
            "yo",
            "zu",
            "xh",
            "af",
            "sq",
            "hy",
            "az",
            "be",
            "bs",
            "cy",
            "eo",
            "et",
            "eu",
            "gl",
            "ha",
            "haw",
            "he",
            "hr",
            "is",
            "ig",
            "iu",
            "ga",
            "ka",
            "kk",
            "ky",
            "la",
            "lv",
            "lt",
            "mk",
            "mg",
            "mi",
            "mn",
            "mt",
            "nb",
            "nn",
            "ny",
            "or",
            "ps",
            "qu",
            "sd",
            "sl",
            "so",
            "st",
            "su",
            "tg",
            "tk",
            "tt",
            "ug",
            "uz",
            "vi",
            "cy",
            "yi",
            "yo"
        ]);
    }

    /**
     * Get available models.
     *
     * @returns Array of available models
     */
    getAvailableModels(): string[] {
        return [...this.availableModels];
    }

    /**
     * Set the relay endpoint (EdgeOne /api/translate).
     *
     * @param url relay endpoint URL
     */
    setRelayEndpoint(url: string): void {
        this.relayEndpoint = (url || "").trim();
    }

    /**
     * Set the translation service mode (official | custom).
     *
     * @param mode "official" 使用内置共享令牌；"custom" 使用用户自有 API Key。
     */
    setServiceMode(mode: string): void {
        this.serviceMode = (mode === "custom") ? "custom" : "official";
    }

    /**
     * Set the API Key for custom relay mode.
     *
     * @param key SiliconFlow API Key（仅 custom 模式使用）
     */
    setApiKey(key: string): void {
        this.apiKey = (key || "").trim();
    }

    /**
     * Set current model to use.
     *
     * @param model model name
     *
     * @returns boolean whether the model was set successfully
     */
    setCurrentModel(model: string): boolean {
        if (this.availableModels.includes(model)) {
            this.currentModel = model;
            return true;
        }
        return false;
    }

    /**
     * Get current model.
     *
     * @returns current model name
     */
    getCurrentModel(): string {
        return this.currentModel;
    }
}

export default AITranslator;
