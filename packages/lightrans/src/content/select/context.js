/** Only the nearby rendered paragraph is used to disambiguate a selection. */
export function getSelectionContext(selection) {
    if (!selection || !selection.rangeCount) return "";
    const range = selection.getRangeAt(0);
    const node = range.commonAncestorContainer;
    const element = node.nodeType === 1 ? node : node.parentElement;
    if (!element || element.closest("input, textarea, [contenteditable]:not([contenteditable='false'])")) return "";
    const block = element.closest("p, li, blockquote, h1, h2, h3, h4, td, div") || element;
    const text = (block.textContent || "").trim();
    const selected = selection.toString().trim();
    if (!selected || text === selected) return "";
    const index = text.indexOf(selected);
    if (index < 0) return "";
    const start = Math.max(0, index - 500);
    return text.slice(start, start + 1200);
}
