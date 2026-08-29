import { TranslationResult } from "../types";

type Provider = "siliconflow" | "gemini";

class AITranslator {
    private static readonly SILICONFLOW_ENDPOINT =
        "https://api.siliconflow.cn/v1/chat/completions";
    private static readonly GEMINI_BASE_ENDPOINT =
        "https://generativelanguage.googleapis.com/v1beta/models";

    private static readonly MODELS: Record<Provider, string[]> = {
        siliconflow: [
            "tencent/Hunyuan-MT-7B",
            "THUDM/GLM-4-9B-0414",
            "Qwen/Qwen3.5-4B",
        ],
        gemini: ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3.7-flash"],
    };

    private static readonly REQUEST_TIMEOUT_MS = 20000;

    private provider: Provider = "siliconflow";
    private apiKey = "";
    private currentModel = "tencent/Hunyuan-MT-7B";

    async detect(text: string): Promise<string> {
        if (/[\u4e00-\u9fa5]/.test(text)) {
            return "zh-CN";
        }
        if (/^[a-zA-Z0-9\s\p{Punctuation}]*$/u.test(text)) {
            return "en";
        }
        return "auto";
    }

    /**
     * Direct provider request. No developer relay, shared token, analytics endpoint,
     * or account backend is involved in this path.
     */
    private async requestTranslate(
        from: string,
        to: string,
        text: string,
        maxTokens: number,
        batch = false
    ): Promise<string> {
        const apiKey = await this.resolveApiKey();
        const providerName = this.provider === "gemini" ? "Gemini" : "SiliconFlow";
        if (!apiKey) {
            throw new Error(`请先填写 ${providerName} API Key`);
        }

        const model = this.getSafeModel();
        const systemPrompt = batch
            ? `You are a professional translator. Translate each numbered text segment (delimited by tags like <1>, <2>) from ${from} to ${to}. Keep exactly the same tag format in your output, one translated segment per tag. Do not merge, split, add or remove any segments. Return only the tagged translations.`
            : `You are a professional translator. Translate the following text from ${from} to ${to}. Preserve meaning, tone, names and formatting. Only return the translated text, no explanations.`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), AITranslator.REQUEST_TIMEOUT_MS);

        try {
            if (this.provider === "gemini") {
                return await this.requestGeminiNative(
                    model,
                    apiKey,
                    systemPrompt,
                    text,
                    maxTokens,
                    controller.signal
                );
            }

            return await this.requestSiliconFlow(
                model,
                apiKey,
                systemPrompt,
                text,
                maxTokens,
                controller.signal
            );
        } catch (error) {
            const candidate = error as { name?: string; message?: string };
            if (candidate?.name === "AbortError") {
                throw new Error(
                    `${providerName} 请求超时（${AITranslator.REQUEST_TIMEOUT_MS / 1000} 秒）。` +
                    "请切换其它模型或检查当前网络/代理。"
                );
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    private async requestSiliconFlow(
        model: string,
        apiKey: string,
        systemPrompt: string,
        text: string,
        maxTokens: number,
        signal: AbortSignal
    ): Promise<string> {
        const body: Record<string, unknown> = {
            model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: text },
            ],
            temperature: 0.2,
            max_tokens: maxTokens,
            ...(model.startsWith("Qwen/") ? { enable_thinking: false } : {}),
        };

        const response = await fetch(AITranslator.SILICONFLOW_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
            signal,
        });

        const data = await AITranslator.readJsonResponse(response, "SiliconFlow");
        const translated = (data?.choices?.[0]?.message?.content || "").toString().trim();
        if (!translated) {
            throw new Error("SiliconFlow 返回了空译文");
        }
        return translated;
    }

    /**
     * Use Gemini's native generateContent endpoint rather than its OpenAI
     * compatibility layer. Google recommends native Gemini API calls when OpenAI
     * library compatibility is not required. Translation is latency-sensitive, so
     * Gemini 3.x thinking is explicitly kept at the lowest supported level.
     */
    private async requestGeminiNative(
        model: string,
        apiKey: string,
        systemPrompt: string,
        text: string,
        maxTokens: number,
        signal: AbortSignal
    ): Promise<string> {
        const generationConfig: Record<string, unknown> = {
            temperature: 0.2,
            maxOutputTokens: maxTokens,
        };

        const thinkingLevel = AITranslator.geminiThinkingLevel(model);
        if (thinkingLevel) {
            generationConfig.thinkingConfig = { thinkingLevel };
        }

        const body = {
            systemInstruction: {
                parts: [{ text: systemPrompt }],
            },
            contents: [
                {
                    role: "user",
                    parts: [{ text }],
                },
            ],
            generationConfig,
        };

        const endpoint =
            `${AITranslator.GEMINI_BASE_ENDPOINT}/${encodeURIComponent(model)}:generateContent`;
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": apiKey,
            },
            body: JSON.stringify(body),
            signal,
        });

        const data = await AITranslator.readJsonResponse(response, "Gemini");
        const parts = data?.candidates?.[0]?.content?.parts;
        const translated = Array.isArray(parts)
            ? parts
                .filter((part: any) => !part?.thought && typeof part?.text === "string")
                .map((part: any) => part.text)
                .join("")
                .trim()
            : "";

        if (!translated) {
            const finishReason = data?.candidates?.[0]?.finishReason;
            const blockReason = data?.promptFeedback?.blockReason;
            const reason = blockReason || finishReason;
            throw new Error(
                reason ? `Gemini 返回了空译文（${reason}）` : "Gemini 返回了空译文"
            );
        }
        return translated;
    }

    private static geminiThinkingLevel(model: string): "minimal" | "low" | null {
        if (model === "gemini-3.7-flash") return "low";
        if (model === "gemini-3.5-flash" || model === "gemini-3.5-flash-lite") {
            return "minimal";
        }
        return null;
    }

    private static async readJsonResponse(response: Response, providerName: string): Promise<any> {
        const raw = await response.text();
        let data: any = {};
        if (raw) {
            try {
                data = JSON.parse(raw);
            } catch {
                data = { raw };
            }
        }

        if (!response.ok) {
            const detail = AITranslator.extractProviderError(data, raw, response.statusText);
            throw new Error(`${providerName} API ${response.status}: ${detail}`);
        }
        return data;
    }

    private static extractProviderError(data: any, raw: string, fallback: string): string {
        const directMessage = data?.error?.message || data?.message;
        if (typeof directMessage === "string" && directMessage.trim()) {
            return directMessage.trim();
        }
        if (typeof data?.error === "string" && data.error.trim()) {
            return data.error.trim();
        }
        if (raw && raw.trim()) {
            return raw.trim().slice(0, 600);
        }
        return fallback || "Unknown provider error";
    }

    /**
     * Read the currently selected provider key directly from local-only browser storage.
     * Reading at request time means changing a key in the options page takes effect
     * immediately without copying secrets into sync storage or messaging them around.
     */
    private async resolveApiKey(): Promise<string> {
        try {
            const runtime = globalThis as unknown as {
                chrome?: {
                    storage?: {
                        local?: {
                            get: (keys: string[], callback: (result: Record<string, unknown>) => void) => void;
                        };
                    };
                };
            };
            const localStorage = runtime.chrome?.storage?.local;
            if (!localStorage) return this.apiKey;

            return await new Promise<string>((resolve) => {
                localStorage.get(["ProviderSecrets"], (result) => {
                    const providerSecrets = result.ProviderSecrets as Record<string, string> | undefined;
                    resolve((providerSecrets?.[this.provider] || this.apiKey || "").trim());
                });
            });
        } catch {
            return this.apiKey;
        }
    }

    async translate(text: string, from: string, to: string): Promise<TranslationResult> {
        try {
            const translatedText = await this.requestTranslate(from, to, text, 1024);
            return {
                originalText: text,
                mainMeaning: translatedText,
                tPronunciation: "",
                sPronunciation: "",
                detailedMeanings: [],
                definitions: [],
                examples: [],
            };
        } catch (error) {
            throw AITranslator.normalizeError(error);
        }
    }

    async translateBatch(texts: string[], from: string, to: string): Promise<string[]> {
        if (texts.length === 0) return [];

        if (texts.length === 1) {
            try {
                const result = await this.translate(texts[0], from, to);
                return [result.mainMeaning];
            } catch (error) {
                if (AITranslator.isTransientError(error)) {
                    throw AITranslator.transientError(error);
                }
                return [texts[0]];
            }
        }

        const merged = texts.map((text, index) => `<${index + 1}> ${text}`).join("\n");
        let parsed: (string | null)[] | null = null;

        try {
            const maxTokens = AITranslator.estimateMaxTokens(merged.length);
            const response = await this.requestTranslate(from, to, merged, maxTokens, true);
            parsed = AITranslator.parseNumberedResult(response, texts.length);
        } catch (error) {
            if (AITranslator.isTransientError(error)) {
                throw AITranslator.transientError(error);
            }
        }

        if (!parsed) {
            return this.translateOneByOne(texts, from, to);
        }

        const results: string[] = [];
        for (let i = 0; i < texts.length; i++) {
            if (parsed[i] !== null) {
                results.push(parsed[i] as string);
                continue;
            }
            try {
                const single = await this.translate(texts[i], from, to);
                results.push(single.mainMeaning);
            } catch {
                results.push(texts[i]);
            }
        }
        return results;
    }

    private async translateOneByOne(texts: string[], from: string, to: string): Promise<string[]> {
        const results: string[] = [];
        for (const text of texts) {
            let translated = text;
            for (let attempt = 0; attempt < 2; attempt++) {
                try {
                    const result = await this.translate(text, from, to);
                    translated = result.mainMeaning;
                    break;
                } catch (error) {
                    if (AITranslator.isTransientError(error) && attempt === 0) {
                        await new Promise((resolve) => setTimeout(resolve, 800));
                        continue;
                    }
                    break;
                }
            }
            results.push(translated);
        }
        return results;
    }

    private static parseNumberedResult(result: string, count: number): (string | null)[] | null {
        if (!result) return null;
        const segments: (string | null)[] = new Array(count).fill(null);
        const regex = /<(\d{1,3})>\s*([\s\S]*?)(?=\n\s*<\d{1,3}>|$)/g;
        let match: RegExpExecArray | null;
        let matched = 0;

        while ((match = regex.exec(result))) {
            const index = parseInt(match[1], 10);
            const translated = match[2].trim();
            if (index >= 1 && index <= count && segments[index - 1] === null && translated) {
                segments[index - 1] = translated;
                matched++;
            }
        }
        return matched > 0 ? segments : null;
    }

    private static estimateMaxTokens(inputChars: number): number {
        const estimated = Math.ceil(inputChars / 2) + 256;
        return Math.min(Math.max(estimated, 1024), 4096);
    }

    private static errorMessage(error: unknown): string {
        const candidate = error as { message?: string; errorMsg?: string; response?: { status?: number } };
        const status = candidate?.response?.status;
        const message = candidate?.message || candidate?.errorMsg || String(error || "Unknown error");
        return status ? `${status}: ${message}` : message;
    }

    private static isTransientError(error: unknown): boolean {
        const message = AITranslator.errorMessage(error);
        return /\b429\b|rate\s*limit|\b5\d\d\b|network|fetch|timeout|超时|temporar/i.test(message);
    }

    private static transientError(error: unknown): Error {
        return new Error(`Transient translation error: ${AITranslator.errorMessage(error)}`);
    }

    private static normalizeError(error: unknown): Error {
        if (error instanceof Error) return error;
        return new Error(AITranslator.errorMessage(error));
    }

    private getSafeModel(): string {
        const model = (this.currentModel || "").trim();
        if (model) return model;
        return AITranslator.MODELS[this.provider][0];
    }

    getAvailableModels(provider?: string): string[] {
        const selected = AITranslator.normalizeProvider(provider || this.provider);
        return [...AITranslator.MODELS[selected]];
    }

    getDefaultModel(provider?: string): string {
        const selected = AITranslator.normalizeProvider(provider || this.provider);
        return AITranslator.MODELS[selected][0];
    }

    setProvider(provider: string): void {
        this.provider = AITranslator.normalizeProvider(provider);
        const allowed = AITranslator.MODELS[this.provider];
        if (!this.currentModel || !allowed.includes(this.currentModel)) {
            this.currentModel = allowed[0];
        }
    }

    getProvider(): string {
        return this.provider;
    }

    /** Compatibility shim for upstream Lightrans' existing manager. */
    setServiceMode(mode: string): void {
        this.setProvider(mode === "gemini" ? "gemini" : "siliconflow");
    }

    setApiKey(key: string): void {
        this.apiKey = (key || "").trim();
    }

    setCurrentModel(model: string): boolean {
        if (model && typeof model === "string" && model.trim()) {
            this.currentModel = model.trim();
            return true;
        }
        return false;
    }

    getCurrentModel(): string {
        return this.currentModel;
    }

    private static normalizeProvider(provider: string): Provider {
        return provider === "gemini" ? "gemini" : "siliconflow";
    }
}

export default AITranslator;
