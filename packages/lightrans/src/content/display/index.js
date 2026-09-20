/** @jsx h */
import { h, render } from "preact";
import CompactPanel from "./CompactPanel.jsx";

(async function initialize() {
    render(<CompactPanel />, document.documentElement);
    // Prepare this polyfill for the useMeasure hook used elsewhere in the display bundle.
    if (!window.ResizeObserver) {
        window.ResizeObserver = (await import("resize-observer-polyfill")).default;
    }
})();
