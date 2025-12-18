const fs = require("fs");
import { LANGUAGES } from "@lightrans/translators";
import { BROWSER_LANGUAGES_MAP } from "common/scripts/languages.js";



describe("All languages in BROWSER_LANGUAGES_MAP should be in LANGUAGES.", () => {
    // Build language set.
    const langSet = new Set();
    for (let lang in LANGUAGES) {
        langSet.add(lang);
    }

    it("check languages in BROWSER_LANGUAGES_MAP", () => {
        for (let langName in BROWSER_LANGUAGES_MAP) {
            let lang = BROWSER_LANGUAGES_MAP[langName];
            expect(langSet).toContain(lang);
        }
    });
});
