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
});
