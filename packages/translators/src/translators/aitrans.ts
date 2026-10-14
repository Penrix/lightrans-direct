import { TranslationResult } from "../types";

type GlossaryEntry = {
    source: string;
    display: string;
};

type TranslationPreferences = {
    glossaryEnabled: boolean;
    glossary: GlossaryEntry[];
};

class AITranslator {
    private static readonly SILICONFLOW_ENDPOINT =
        "https://api.siliconflow.cn/v1/chat/completions";

    private static readonly MODELS = [
        "THUDM/GLM-4-9B-0414",
        "tencent/Hunyuan-MT-7B",
        "Qwen/Qwen3.5-4B",
    ];

    private static readonly REQUEST_TIMEOUT_MS = 20000;
    private static readonly DEFAULT_GLOSSARY = "";
    private static readonly LEGACY_SOFTWARE_GLOSSARY =
        "Obsidian = Obsidian（笔记与知识管理软件）";

    private apiKey = "";
    private provider = "ollama";
    private currentModel = "kaelri/hy-mt2:1.8b";

    async detect(text: string): Promise<string> {
        const value = text || "";
        if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(value)) return "ja";
        const hanCount = (value.match(/\p{Script=Han}/gu) || []).length;
        const latinCount = (value.match(/\p{Script=Latin}/gu) || []).length;

        if (hanCount === 0 && latinCount === 0) return "auto";
        if (latinCount > hanCount) return "en";
        if (hanCount > latinCount) return "zh-CN";

        // Truly mixed text is better left unresolved than forced into the wrong
        // source language. The translation prompt will fall back gracefully.
        return "auto";
    }

    private async resolveSourceLanguage(from: string, text: string): Promise<string> {
        const configured = (from || "auto").trim();
        if (configured && configured !== "auto") return configured;

        return this.detect(text);
    }

    /**
     * Translate through the explicitly selected local or cloud provider.
     *
     * "auto" is resolved locally whenever the script balance is clear, so the model
     * normally receives an explicit language pair such as en -> zh-CN. This keeps
     * ordinary English translation behavior natural without special term patches.
     *
     * User-defined glossary entries remain an intentional override layer and are
     * protected with deterministic placeholders before generation, then restored.
     */
    private async requestTranslate(
        from: string,
        to: string,
        text: string,
        maxTokens: number,
        batch = false,
        context = ""
    ): Promise<string> {
        const provider = this.provider;
        const model = this.getSafeModel();
        const apiKey = provider === "siliconflow" ? await this.resolveApiKey() : "";
        if (provider === "siliconflow" && !apiKey) {
            throw new Error("请先填写 SiliconFlow API Key");
        }

        const resolvedFrom = await this.resolveSourceLanguage(from, text);
        const sourceLabel = resolvedFrom === "auto" ? "the source language" : resolvedFrom;
        const preferences = await this.resolveTranslationPreferences();
        const protectedText = preferences.glossaryEnabled
            ? AITranslator.protectGlossary(text, preferences.glossary)
            : { text, replacements: [] as Array<{ token: string; display: string }> };

        const glossaryInstruction = protectedText.replacements.length > 0
            ? " Preserve every placeholder token matching ZXQTERM followed by four digits and QXZ exactly as written. Treat each placeholder as opaque: never translate it, annotate it, explain it, remove it, split it, or alter it."
            : "";

        const systemPrompt = batch
            ? `Translate each numbered segment from ${sourceLabel} to ${to}. Keep every <N> tag exactly and return only tagged translations.${glossaryInstruction}`
            : `Translate the text from ${sourceLabel} to ${to}. Preserve meaning, tone and formatting. Return only the translation.${glossaryInstruction}`;

        const controller = new AbortController();
        const timeoutMs = provider === "ollama" ? 60000 : AITranslator.REQUEST_TIMEOUT_MS;
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const translated = provider === "ollama"
                ? await this.requestOllama(model, to, protectedText.text, maxTokens, batch, context, glossaryInstruction, controller.signal)
                : await this.requestSiliconFlow(
                model,
                apiKey,
                systemPrompt,
                protectedText.text,
                maxTokens,
                controller.signal
            );
            const cleaned = AITranslator.stripPlaceholderAnnotations(
                translated,
                protectedText.replacements
            );
            return AITranslator.restoreGlossary(cleaned, protectedText.replacements);
        } catch (error) {
            const candidate = error as { name?: string; message?: string };
            if (candidate?.name === "AbortError") {
                throw new Error(
                    `${provider === "ollama" ? "Ollama 本地模型" : "SiliconFlow"} 请求超时（${timeoutMs / 1000} 秒）。` +
                    (provider === "ollama" ? "请确认 Ollama 正在运行，或缩短待翻译文本。" : "请切换其它模型或检查当前网络/代理。")
                );
            }
            if (provider === "ollama" && candidate?.name === "TypeError") {
                throw new Error("无法连接 Ollama 本地翻译服务，请启动 Ollama 后再试。不会自动切换到云端。");
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    private async requestOllama(
        model: string, to: string, text: string, maxTokens: number,
        batch: boolean, context: string, glossaryInstruction: string, signal: AbortSignal
    ): Promise<string> {
        const target = ({ "zh-CN": "简体中文", "zh-TW": "繁体中文", en: "英语", ja: "日语" } as Record<string, string>)[to] || to;
        const instruction = batch
            ? `将以下各段翻译为${target}。保留每个 <N> 编号，只输出带编号的译文，不要额外解释：`
            : context
                ? `${context.slice(0, 1200)}\n参考上面的信息，把下面的文本翻译成${target}，注意不需要翻译上文，也不要额外解释：`
                : `将以下文本翻译为${target}，注意只需要输出翻译后的结果，不要额外解释：`;
        const response = await fetch("http://127.0.0.1:11434/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model, prompt: `${instruction}${glossaryInstruction}\n\n${text}`,
                stream: false, keep_alive: "30m",
                options: { num_ctx: 4096, num_predict: maxTokens },
            }),
            signal,
        });
        const data = await AITranslator.readJsonResponse(response, "Ollama");
        if (data.done_reason === "length") throw new Error("Ollama 译文超出长度限制，请缩短待翻译文本。");
        const translated = (data.response || "").toString().trim();
        if (!translated) throw new Error("Ollama 返回了空译文");
        return translated;
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
                    resolve((providerSecrets?.siliconflow || this.apiKey || "").trim());
                });
            });
        } catch {
            return this.apiKey;
        }
    }

    private async resolveTranslationPreferences(): Promise<TranslationPreferences> {
        const fallback: TranslationPreferences = {
            glossaryEnabled: true,
            glossary: AITranslator.parseGlossary(AITranslator.DEFAULT_GLOSSARY),
        };

        try {
            const runtime = globalThis as unknown as {
                chrome?: {
                    storage?: {
                        sync?: {
                            get: (keys: string[], callback: (result: Record<string, unknown>) => void) => void;
                        };
                    };
                };
            };
            const syncStorage = runtime.chrome?.storage?.sync;
            if (!syncStorage) return fallback;

            return await new Promise<TranslationPreferences>((resolve) => {
                syncStorage.get(["GlossaryEnabled", "GlossaryText"], (result) => {
                    let glossaryText = typeof result.GlossaryText === "string"
                        ? result.GlossaryText
                        : AITranslator.DEFAULT_GLOSSARY;
                    if (glossaryText.trim() === AITranslator.LEGACY_SOFTWARE_GLOSSARY) {
                        glossaryText = "";
                    }
                    resolve({
                        glossaryEnabled: result.GlossaryEnabled !== false,
                        glossary: AITranslator.parseGlossary(glossaryText),
                    });
                });
            });
        } catch {
            return fallback;
        }
    }

    private static parseGlossary(text: string): GlossaryEntry[] {
        const entries: GlossaryEntry[] = [];
        const seen = new Set<string>();

        for (const rawLine of (text || "").split(/\r?\n/)) {
            const line = rawLine.trim();
            if (!line || line.startsWith("#")) continue;

            let separatorIndex = line.indexOf("=>");
            let separatorLength = 2;
            if (separatorIndex < 0) {
                separatorIndex = line.indexOf("=");
                separatorLength = 1;
            }
            if (separatorIndex <= 0) continue;

            const source = line.slice(0, separatorIndex).trim();
            const display = line.slice(separatorIndex + separatorLength).trim();
            if (!source || !display || seen.has(source)) continue;

            seen.add(source);
            entries.push({ source, display });
            if (entries.length >= 200) break;
        }

        return entries.sort((a, b) => b.source.length - a.source.length);
    }

    private static protectGlossary(
        text: string,
        glossary: GlossaryEntry[]
    ): { text: string; replacements: Array<{ token: string; display: string }> } {
        let protectedText = text;
        const replacements: Array<{ token: string; display: string }> = [];
        let tokenIndex = 0;

        for (const entry of glossary) {
            if (!protectedText.includes(entry.source)) continue;
            const token = `ZXQTERM${String(tokenIndex).padStart(4, "0")}QXZ`;
            protectedText = protectedText.split(entry.source).join(token);
            replacements.push({ token, display: entry.display });
            tokenIndex++;
        }

        return { text: protectedText, replacements };
    }

    /**
     * If a model adds an unsolicited parenthetical explanation directly after a
     * protected placeholder, remove that suffix before deterministic restoration.
     * This is deliberately narrow so normal source parentheses remain untouched.
     */
    private static stripPlaceholderAnnotations(
        text: string,
        replacements: Array<{ token: string; display: string }>
    ): string {
        let cleaned = text;
        for (const replacement of replacements) {
            const escaped = replacement.token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const accidentalAnnotation = new RegExp(
                `${escaped}\\s*[（(][^）)\\n]{0,100}[）)]`,
                "g"
            );
            cleaned = cleaned.replace(accidentalAnnotation, replacement.token);
        }
        return cleaned;
    }

    private static restoreGlossary(
        text: string,
        replacements: Array<{ token: string; display: string }>
    ): string {
        let restored = text;
        for (const replacement of replacements) {
            restored = restored.split(replacement.token).join(replacement.display);
        }
        return restored;
    }

    async translate(text: string, from: string, to: string, context = ""): Promise<TranslationResult> {
        try {
            const translatedText = await this.requestTranslate(from, to, text, AITranslator.estimateMaxTokens(text.length), false, context);
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
        return model || this.getDefaultModel();
    }

    getAvailableModels(provider = this.provider): string[] {
        return provider === "ollama" ? ["kaelri/hy-mt2:1.8b"] : [...AITranslator.MODELS];
    }

    getDefaultModel(provider = this.provider): string {
        return this.getAvailableModels(provider)[0];
    }

    setProvider(provider: string): void {
        const next = provider === "siliconflow" ? "siliconflow" : "ollama";
        if (this.provider !== next) {
            this.provider = next;
            this.currentModel = this.getDefaultModel();
        }
    }

    getProvider(): string {
        return this.provider;
    }

    /** Compatibility shim for upstream Lightrans' manager. */
    setServiceMode(mode: string): void {
        this.setProvider(mode);
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
}

export default AITranslator;
