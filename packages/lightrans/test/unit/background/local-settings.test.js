import { chrome } from "jest-chrome";
import { DEFAULT_SETTINGS, getOrSetDefaultSettings } from "common/scripts/settings.js";

test("upgrading selects local Chinese translation once, preserving secrets and glossary", async () => {
    const stored = { TranslationService: "siliconflow", AIModel: "cloud-model", OtherSettings: { EnglishToSimplifiedChineseOnly: true, MutualTranslate: true }, GlossaryText: "payoff = 铺垫兑现" };
    chrome.storage.sync.get.mockImplementation((_keys, callback) => callback({ ...stored }));
    chrome.storage.sync.set.mockImplementation((value, callback) => { Object.assign(stored, value); if (callback) callback(); });
    const result = await getOrSetDefaultSettings(undefined, DEFAULT_SETTINGS);
    expect(result.TranslationService).toBe("ollama");
    expect(result.AIModel).toBe("kaelri/hy-mt2:1.8b");
    expect(result.OtherSettings.EnglishToSimplifiedChineseOnly).toBe(false);
    expect(result.OtherSettings.MutualTranslate).toBe(false);
    expect(result.GlossaryText).toBe("payoff = 铺垫兑现");
    stored.TranslationService = "siliconflow";
    stored.AIModel = "cloud-model";
    const next = await getOrSetDefaultSettings(undefined, DEFAULT_SETTINGS);
    expect(next.TranslationService).toBe("siliconflow");
    expect(next.AIModel).toBe("cloud-model");
});
