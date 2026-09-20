import Channel from "common/scripts/channel.js";
import { DEFAULT_SETTINGS, getOrSetDefaultSettings } from "common/scripts/settings.js";

/**
 * Control the visibility of page translator banners.
 */
class BannerController {
    constructor() {
        // Communication channel.
        this.channel = new Channel();

        // Current page translator.
        this.currentTranslator = null;

        // Message listener canceller for legacy page translators.
        this.canceller = null;

        // Canceller for the AI page-translation atomic display guard.
        this.atomicPageCanceller = null;

        this.addListeners();
    }

    /**
     * Add event and message listeners.
     */
    addListeners() {
        this.channel.on(
            "start_page_translate",
            ((detail) => {
                switch (detail.translator) {
                    case "google": {
                        this.currentTranslator = "google";
                        let handler = this.googleMessageHandler.bind(this);
                        window.addEventListener("message", handler);
                        this.canceller = (() => {
                            window.removeEventListener("message", handler);
                        }).bind(this);
                        break;
                    }
                    case "aitrans": {
                        this.currentTranslator = "aitrans";
                        this.startAtomicAIPageView();
                        break;
                    }
                    default:
                        break;
                }
            }).bind(this)
        );

        this.channel.on("command", (detail) => {
            switch (detail.command) {
                case "toggle_page_translate_banner":
                    this.toggleBanner();
                    break;
                default:
                    break;
            }
        });
    }

    /**
     * Keep the visible page in its original state while AI page translation is
     * still running. The scheduler may continue batching and running requests
     * concurrently for throughput, but users only see the translated page after
     * every text entry has a result (including fallback-to-original results).
     *
     * The injected page translator stores source nodes in
     * window.lightransOriginalTextNodes and adds translatedText to each entry as
     * batches complete. MutationObserver runs before browser paint, so restoring
     * partial replacements here prevents visible section-by-section translation.
     * Once all entries are ready, the guard stops and the translator's final
     * applyMode() result is left untouched.
     */
    startAtomicAIPageView() {
        if (this.atomicPageCanceller) {
            this.atomicPageCanceller();
            this.atomicPageCanceller = null;
        }

        let observer = null;
        let readinessTimer = null;
        let startupTimer = null;
        let safetyTimer = null;
        let stopped = false;

        const cleanup = () => {
            if (stopped) return;
            stopped = true;
            if (observer) observer.disconnect();
            if (readinessTimer) clearInterval(readinessTimer);
            if (startupTimer) clearTimeout(startupTimer);
            if (safetyTimer) clearTimeout(safetyTimer);
            if (this.atomicPageCanceller === cleanup) this.atomicPageCanceller = null;
        };

        const setupGuard = () => {
            if (stopped) return;

            const entries = window.lightransOriginalTextNodes;
            if (!Array.isArray(entries)) {
                // executeScript normally creates the array before emitting
                // start_page_translate, but retry briefly for slow/special pages.
                startupTimer = setTimeout(setupGuard, 20);
                return;
            }

            const nodeMap = new Map();
            entries.forEach((entry) => {
                if (entry && entry.node) nodeMap.set(entry.node, entry);
            });

            const allReady = () =>
                entries.length === 0 ||
                entries.every(
                    (entry) => entry && Object.prototype.hasOwnProperty.call(entry, "translatedText")
                );

            if (allReady()) {
                cleanup();
                return;
            }

            const restorePartialResults = () => {
                nodeMap.forEach((entry, node) => {
                    if (
                        node &&
                        typeof entry.originalText === "string" &&
                        node.nodeValue !== entry.originalText
                    ) {
                        node.nodeValue = entry.originalText;
                    }
                });
            };

            // A very fast first batch may have completed between executeScript
            // returning and this listener running, so normalize once immediately.
            restorePartialResults();

            observer = new MutationObserver((mutations) => {
                // The last batch, banner update and final applyMode() all happen in
                // one synchronous task. At the observer microtask checkpoint all
                // entries are ready, so disconnect without undoing the final page.
                if (allReady()) {
                    cleanup();
                    return;
                }

                mutations.forEach((mutation) => {
                    if (mutation.type !== "characterData") return;
                    const entry = nodeMap.get(mutation.target);
                    if (
                        entry &&
                        typeof entry.originalText === "string" &&
                        mutation.target.nodeValue !== entry.originalText
                    ) {
                        mutation.target.nodeValue = entry.originalText;
                    }
                });
            });

            if (document.body) {
                observer.observe(document.body, {
                    subtree: true,
                    characterData: true,
                });
            }

            // Original/bilingual modes may not mutate source text during progress,
            // so also poll readiness and release the guard when the page is done.
            readinessTimer = setInterval(() => {
                if (allReady()) cleanup();
            }, 50);

            // Never leave an observer around forever on a pathological page.
            safetyTimer = setTimeout(cleanup, 10 * 60 * 1000);
        };

        this.atomicPageCanceller = cleanup;
        setupGuard();
    }

    /**
     * Toggle the visibility of banner frame.
     *
     * @param {boolean} visible the visibility of banner frame.
     * @returns {void} nothing
     */
    toggleBannerFrame(visible) {
        switch (this.currentTranslator) {
            case "google": {
                let banner = document.getElementById(":0.container");
                if (banner !== null && banner !== undefined) {
                    banner.style.visibility = visible ? "visible" : "hidden";
                    return;
                }
                break;
            }
            default:
                break;
        }
    }

    /**
     * Move the page body.
     *
     * @param {String} property indicates which style property to use for moving. Google uses "top".
     *
     * @param {Number} distance the distance to move.
     * @param {boolean} absolute whether the distance is relative or absolute.
     */
    movePage(property, distance, absolute) {
        let orig = document.body.style.getPropertyValue(property);
        try {
            // The property has value originally.
            let orig_value = parseInt(orig, 10);
            document.body.style.cssText = document.body.style.cssText.replace(
                new RegExp(`${property}:.*;`, "g"),
                `${property}: ${absolute ? distance : orig_value + distance}px !important;`
            );
        } catch {
            // The property has no valid value originally, move absolutely.
            document.body.style.setProperty(property, `${distance}px`, "important");
        }
    }

    /**
     * Handle messages sent by Google page translator.
     *
     * @param {Object} msg the message content.
     * @returns {void} nothing
     */
    googleMessageHandler(msg) {
        let data = JSON.parse(msg.data);
        if (!data.type || data.type !== "lightrans_page_translate_event") return;

        switch (data.event) {
            case "page_moved":
                // The "page_moved" event may be sent when the banner is created or destroyed.
                // If the distance property is positive, it means the banner is created, and
                // the page has been moved down. Else if it is negative, it means the banner is
                // destroyed, and the banner has been moved up.
                getOrSetDefaultSettings("HidePageTranslatorBanner", DEFAULT_SETTINGS).then(
                    (result) => {
                        if (result.HidePageTranslatorBanner) {
                            setTimeout(() => {
                                this.toggleBannerFrame(false);
                                // If user decide to hide the banner, we just keep the top
                                // of the page at 0px.
                                this.movePage("top", 0, true);
                            }, 0);
                        }
                    }
                );

                // If the banner is destroyed, we should cancel listeners.
                if (data.distance <= 0) {
                    if (this.canceller) this.canceller();
                    this.canceller = null;
                    this.currentTranslator = null;
                }
                break;
            default:
                break;
        }
    }

    /**
     * Toggle the visibility of the banner.
     *
     * @returns {void} nothing
     */
    toggleBanner() {
        if (!this.currentTranslator) return;

        getOrSetDefaultSettings("HidePageTranslatorBanner", DEFAULT_SETTINGS).then((result) => {
            result.HidePageTranslatorBanner = !result.HidePageTranslatorBanner;
            chrome.storage.sync.set(result);

            switch (this.currentTranslator) {
                case "google": {
                    if (result.HidePageTranslatorBanner) {
                        // Hide the banner.
                        this.toggleBannerFrame(false);
                        this.movePage("top", 0, true);
                    } else {
                        // Show the banner.
                        this.toggleBannerFrame(true);
                        this.movePage("top", 40, true);
                    }
                    break;
                }
                default:
                    break;
            }
        });
    }
}

// Create the object.
window.lightransBannerController = new BannerController();
