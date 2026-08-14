import axios from "../axios";
import { TranslationResult } from "../types";

class AITranslator {
    /**
     * 共享中继令牌（免费模式走我们自己的 API 反代服务时使用，用于区分「谁都能调」与「知道令牌才能调」，
     * 并非 SiliconFlow 密钥。会进入扩展 bundle，但能挡住随手白嫖）。
     * 必须与 EdgeOne 中继 edge-functions/api/translate.js 中的 RELAY_TOKEN 一致。
     */
    private readonly RELAY_TOKEN: string = "3bfca6f691946ca6391ef342411758747dfa6f481a04bfb4";

    /** 免费模式固定地址：我们自己部署的 API 反代服务（EdgeOne 中继），强制使用，避免被旧设置覆盖。 */
    private readonly OFFICIAL_RELAY_ENDPOINT: string = "https://trans.hin.cool/api/translate";

    /** 自定义模式默认 API 接口：直连硅基流动官方端点（注意不是我们的中继服务）。 */
    private static readonly SILICONFLOW_ENDPOINT: string = "https://api.siliconflow.cn/v1/chat/completions";

    /**
     * 翻译服务模式：
     * - "free"：硅基流动（免费），走我们自己部署的 API 反代服务，内置共享令牌，零配置、无需 API Key；
     * - "custom"：硅基流动（自定义），用户填自己的 SiliconFlow API Key，直连硅基流动官方端点。
     */
    private serviceMode: string = "free";

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
            const headers: Record<string, string> = {
                "Content-Type": "application/json",
            };

            // 发送前兜底：currentModel 为空或被污染时，回退到安全模型，避免把空/非法模型名发到
            // 中继（免费模式）或官方端点（自定义模式）导致 502 / 上游报错。
            const safeModel = this.getSafeModel();

            if (this.serviceMode === "custom") {
                // 硅基流动（自定义）：直连官方端点，使用用户自有 API Key 鉴权。
                if (!this.apiKey) {
                    throw new Error("自定义模式需要填写 SiliconFlow API Key");
                }
                const endpoint = AITranslator.SILICONFLOW_ENDPOINT;
                headers["Authorization"] = `Bearer ${this.apiKey}`;

                // 与中继服务保持一致的请求结构，保证两种模式翻译质量一致
                const response = await axios.post(endpoint, {
                    model: safeModel,
                    messages: [
                        {
                            role: "system",
                            content: `You are a professional translator. Translate the following text from ${from} to ${to}. Only return the translated text, no other content.`
                        },
                        { role: "user", content: text }
                    ],
                    temperature: 0.3,
                    max_tokens: 1024,
                    // 仅 Qwen 系列关闭思考模式（与中继服务保持一致）
                    enable_thinking: this.currentModel.startsWith("Qwen/") ? false : undefined
                }, { headers });

                const translatedText = (response.data?.choices?.[0]?.message?.content || "").toString().trim();

                return {
                    originalText: text,
                    mainMeaning: translatedText,
                    tPronunciation: "",
                    sPronunciation: "",
                    detailedMeanings: [],
                    definitions: [],
                    examples: []
                };
            }

            // 硅基流动（免费）：走我们自己部署的 API 反代服务，内置共享令牌，SiliconFlow Key 不进扩展。
            const endpoint = this.OFFICIAL_RELAY_ENDPOINT;
            headers["X-Lightrans-Token"] = this.RELAY_TOKEN;

            const response = await axios.post(endpoint, {
                text,
                from,
                to,
                model: safeModel
            }, { headers });

            // 中继返回 { translatedText }
            const translatedText = (response.data?.translatedText || "").toString().trim();

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
     * Set the translation service mode (free | custom).
     *
     * @param mode "free" 走我们的反代服务（内置共享令牌）；"custom" 直连硅基流动（用户自有 Key）。
     */
    setServiceMode(mode: string): void {
        this.serviceMode = (mode === "custom") ? "custom" : "free";
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
     * @param model model name（支持设置页自定义输入的非预设模型名）
     *
     * @returns boolean whether the model was set successfully
     */
    setCurrentModel(model: string): boolean {
        if (model && typeof model === "string") {
            this.currentModel = model.trim();
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

    /**
     * 计算发送翻译请求时实际使用的「安全模型名」。
     *
     * 兜底逻辑（根因修复）：currentModel 可能因为以下情况被污染为空值或非法模型名——
     * - 自定义模式勾选了「自定义模型」但模型名未填写；
     * - 切换服务模式 / 模型时重算失败（setCurrentModel 对空值静默 no-op）；
     * - 各路径间 currentModel 与 AIModel 失同步。
     * 一旦把空/非法模型名发给中继（免费模式）或官方端点（自定义模式），上游报错会透传成 502。
     *
     * 规则：
     * - currentModel 为空 → 回退到预设列表首个模型；
     * - 免费模式下 currentModel 不在预设列表（中继仅放行这些）→ 同样回退到预设列表首个模型；
     * - 其余情况原样返回。
     *
     * @returns 保证非空、且在免费模式下一定被中继接受的模型名
     */
    private getSafeModel(): string {
        const current = (this.currentModel || "").trim();
        if (!current) {
            return this.availableModels[0];
        }
        if (this.serviceMode === "free" && !this.availableModels.includes(current)) {
            return this.availableModels[0];
        }
        return current;
    }
}

export default AITranslator;
