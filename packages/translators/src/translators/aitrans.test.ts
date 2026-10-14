import AITranslator from "./aitrans";

describe("AITranslator source-language detection", () => {
    const translator = new AITranslator();

    test("detects English when Latin text dominates mixed content", async () => {
        await expect(
            translator.detect("OpenAI builds powerful language models for developers. 中文")
        ).resolves.toBe("en");
    });

    test("detects Chinese when Han text dominates embedded English names", async () => {
        await expect(
            translator.detect("这是一个介绍 OpenAI 和 API 使用方式的中文页面。")
        ).resolves.toBe("zh-CN");
    });

    test("leaves punctuation-only content unresolved", async () => {
        await expect(translator.detect("1234 -- ...")).resolves.toBe("auto");
    });

    test("detects Japanese before counting its shared Han characters", async () => {
        await expect(translator.detect("主人公は仲間を守るために選択した。")).resolves.toBe("ja");
    });
});

describe("local translation and manual cloud routing", () => {
    let fetchMock: jest.Mock;
    beforeEach(() => {
        fetchMock = jest.fn().mockResolvedValue({ ok: true, text: async () => JSON.stringify({ response: "铺垫兑现" }) });
        global.fetch = fetchMock;
        (chrome.storage.local.get as jest.Mock).mockImplementation((_keys: unknown, callback: (value: object) => void) => callback({}));
        (chrome.storage.sync.get as jest.Mock).mockImplementation((_keys: unknown, callback: (value: object) => void) => callback({}));
    });
    test("defaults to local generation without requiring or transmitting a key", async () => {
        const translator = new AITranslator();
        translator.setApiKey("cloud-secret");
        const result = await translator.translate("payoff", "en", "zh-CN");
        expect(result.mainMeaning).toBe("铺垫兑现");
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe("http://127.0.0.1:11434/api/generate");
        expect(init.headers.Authorization).toBeUndefined();
        expect(JSON.parse(init.body)).toMatchObject({ model: "kaelri/hy-mt2:1.8b", stream: false });
    });
    test("uses context to translate only the selected term", async () => {
        const translator = new AITranslator();
        await (translator.translate as Function)("payoff", "en", "zh-CN", "讨论小说伏笔在高潮的兑现。");
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.prompt).toContain("讨论小说伏笔在高潮的兑现。");
        expect(body.prompt).toContain("不需要翻译上文");
        expect(body.prompt).toContain("payoff");
    });
    test("local failure does not send any cloud request", async () => {
        fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
        await expect(new AITranslator().translate("hello", "en", "zh-CN")).rejects.toThrow("Ollama");
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    test("explicit cloud selection uses SiliconFlow and its key", async () => {
        fetchMock.mockResolvedValue({ ok: true, text: async () => JSON.stringify({ choices: [{ message: { content: "你好" } }] }) });
        const translator = new AITranslator();
        translator.setProvider("siliconflow");
        translator.setApiKey("test-key");
        await translator.translate("hello", "en", "zh-CN");
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe("https://api.siliconflow.cn/v1/chat/completions");
        expect(init.headers.Authorization).toBe("Bearer test-key");
        expect(JSON.parse(init.body).model).toBe("THUDM/GLM-4-9B-0414");
    });
    test("nearby context remains local even when the cloud provider is selected", async () => {
        fetchMock.mockResolvedValue({ ok: true, text: async () => JSON.stringify({ choices: [{ message: { content: "兑现" } }] }) });
        const translator = new AITranslator();
        translator.setProvider("siliconflow"); translator.setApiKey("test-key");
        await translator.translate("payoff", "en", "zh-CN", "private-nearby-context");
        expect(fetchMock.mock.calls[0][1].body).not.toContain("private-nearby-context");
    });
    test("retains numbered segment boundaries and glossary overrides", async () => {
        (chrome.storage.sync.get as jest.Mock).mockImplementation((_keys: unknown, callback: (value: object) => void) => callback({ GlossaryEnabled: true, GlossaryText: "API = 接口" }));
        fetchMock.mockResolvedValue({ ok: true, text: async () => JSON.stringify({ response: "<1> 使用 ZXQTERM0000QXZ\n<2> 主角归来。" }) });
        const result = await new AITranslator().translateBatch(["Use API", "The hero returns."], "en", "zh-CN");
        expect(result).toEqual(["使用 接口", "主角归来。"]);
    });
});

