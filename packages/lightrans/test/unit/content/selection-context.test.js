import { getSelectionContext } from "../../../src/content/select/context.js";

test("captures the selected term's paragraph rather than the entire conversation", () => {
    document.body.innerHTML = '<p>不相关的旧话题。</p><p>男频小说中的 <strong>payoff</strong> 是前文铺垫的兑现。</p><p>不相关的后文。</p>';
    const range = document.createRange();
    range.selectNodeContents(document.querySelector("strong"));
    const selection = window.getSelection();
    selection.removeAllRanges(); selection.addRange(range);
    expect(getSelectionContext(selection)).toBe("男频小说中的 payoff 是前文铺垫的兑现。");
});

test("does not take context from password or editable fields", () => {
    document.body.innerHTML = '<div contenteditable="true">private payoff</div>';
    const range = document.createRange(); range.selectNodeContents(document.querySelector("div"));
    const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
    expect(getSelectionContext(selection)).toBe("");
});
