/** @jsx h */
import { h } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import styled from "styled-components";
import root from "react-shadow/styled-components";
import Channel from "common/scripts/channel.js";
import CopyIcon from "./icons/copy.svg";
import CloseIcon from "./icons/close.svg";

const channel = new Channel();
const MAX_Z_INDEX = 2147483647;
const VIEWPORT_MARGIN = 8;
const ANCHOR_GAP = 8;
const CHATGPT_HOST_RE = /(^|\.)chatgpt\.com$/i;

window.translateResult = window.translateResult || {};
window.isDisplayingResult = false;

function clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
}

function rectsOverlap(a, b) {
    return !(
        a.right <= b.left ||
        a.left >= b.right ||
        a.bottom <= b.top ||
        a.top >= b.bottom
    );
}

function isOpenPopover(element) {
    try {
        return element.matches?.(":popover-open") || false;
    } catch {
        return false;
    }
}

/**
 * Check whether an element (or one of its ancestors) behaves like a floating
 * contextual UI. Native popovers live in the browser top layer, so even our
 * maximum z-index cannot cover them; those must be avoided geometrically.
 */
function isFloatingOverlay(element, panel) {
    let current = element;
    while (current && current !== document.documentElement) {
        if (panel?.contains(current)) return false;
        if (!(current instanceof Element)) break;

        const role = current.getAttribute("role") || "";
        const style = window.getComputedStyle(current);
        const position = style.position;
        const zIndex = Number.parseInt(style.zIndex, 10);

        if (isOpenPopover(current)) return true;

        if (["dialog", "menu", "toolbar", "listbox", "tooltip"].includes(role)) {
            if (["fixed", "absolute", "sticky"].includes(position)) return true;
        }

        if (
            ["fixed", "absolute", "sticky"].includes(position) &&
            Number.isFinite(zIndex) &&
            zIndex >= 10 &&
            style.pointerEvents !== "none"
        ) {
            return true;
        }

        current = current.parentElement;
    }
    return false;
}

function overlayScoreForRect(rect, panel) {
    const inset = 4;
    const xs = [rect.left + inset, (rect.left + rect.right) / 2, rect.right - inset];
    const ys = [rect.top + inset, (rect.top + rect.bottom) / 2, rect.bottom - inset];
    const seen = new Set();
    let score = 0;

    xs.forEach((x) => {
        ys.forEach((y) => {
            if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) return;
            const elements = document.elementsFromPoint(x, y);
            for (const element of elements) {
                if (seen.has(element)) continue;
                seen.add(element);
                if (isFloatingOverlay(element, panel)) {
                    score += 1;
                    break;
                }
            }
        });
    });

    return score;
}

export default function CompactPanel() {
    const [view, setView] = useState({
        open: false,
        type: "LOADING",
        text: "",
        error: "",
    });
    const panelRef = useRef(null);
    const latestTimestampRef = useRef(0);
    const anchorRef = useRef({
        position: null,
        selectionHeight: 0,
        originalText: "",
    });

    const acceptTimestamp = useCallback((timestamp) => {
        if (typeof timestamp !== "number") return true;
        if (timestamp < latestTimestampRef.current) return false;
        latestTimestampRef.current = timestamp;
        return true;
    }, []);

    const closePanel = useCallback(() => {
        setView((current) => (current.open ? { ...current, open: false } : current));
        window.isDisplayingResult = false;
        channel.emit("frame_closed");
    }, []);

    const currentSelectionRect = useCallback(() => {
        try {
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0 || !selection.toString().trim()) return null;
            const rect = selection.getRangeAt(selection.rangeCount - 1).getBoundingClientRect();
            if (!Number.isFinite(rect.left) || !Number.isFinite(rect.top)) return null;
            return rect;
        } catch {
            return null;
        }
    }, []);

    const fallbackAnchorRect = useCallback(() => {
        const { position, selectionHeight } = anchorRef.current;
        if (!Array.isArray(position) || position.length < 2) return null;
        const left = Number(position[0]);
        const top = Number(position[1]);
        if (!Number.isFinite(left) || !Number.isFinite(top)) return null;
        const height = Number(selectionHeight) || 0;
        return {
            left,
            right: left,
            top,
            bottom: top + height,
            width: 0,
            height,
        };
    }, []);

    const positionPanel = useCallback(() => {
        const panel = panelRef.current;
        if (!panel) return;

        const panelRect = panel.getBoundingClientRect();
        const anchor = currentSelectionRect() || fallbackAnchorRect();

        let left;
        let top;

        if (anchor) {
            const panelWidth = panelRect.width;
            const panelHeight = panelRect.height;
            const anchorWidth = anchor.width || Math.max(0, anchor.right - anchor.left);
            const anchorHeight = anchor.height || Math.max(0, anchor.bottom - anchor.top);
            const anchorCenterX = anchor.left + anchorWidth / 2;
            const anchorCenterY = anchor.top + anchorHeight / 2;

            const candidatesByName = {
                above: {
                    name: "above",
                    left: anchorCenterX - panelWidth / 2,
                    top: anchor.top - panelHeight - ANCHOR_GAP,
                },
                below: {
                    name: "below",
                    left: anchorCenterX - panelWidth / 2,
                    top: anchor.bottom + ANCHOR_GAP,
                },
                right: {
                    name: "right",
                    left: anchor.right + ANCHOR_GAP,
                    top: anchorCenterY - panelHeight / 2,
                },
                left: {
                    name: "left",
                    left: anchor.left - panelWidth - ANCHOR_GAP,
                    top: anchorCenterY - panelHeight / 2,
                },
            };

            // ChatGPT's own selection actions occupy the space above selected text.
            // Prefer below there, while still using collision scoring so this stays
            // resilient if ChatGPT changes its menu placement later.
            const preference = CHATGPT_HOST_RE.test(window.location.hostname)
                ? ["below", "right", "left", "above"]
                : ["above", "below", "right", "left"];

            const anchorRect = {
                left: anchor.left,
                right: anchor.right,
                top: anchor.top,
                bottom: anchor.bottom,
            };

            const candidates = preference.map((name, preferenceIndex) => {
                const raw = candidatesByName[name];
                const candidateLeft = clamp(
                    raw.left,
                    VIEWPORT_MARGIN,
                    Math.max(VIEWPORT_MARGIN, window.innerWidth - panelWidth - VIEWPORT_MARGIN)
                );
                const candidateTop = clamp(
                    raw.top,
                    VIEWPORT_MARGIN,
                    Math.max(VIEWPORT_MARGIN, window.innerHeight - panelHeight - VIEWPORT_MARGIN)
                );
                const rect = {
                    left: candidateLeft,
                    right: candidateLeft + panelWidth,
                    top: candidateTop,
                    bottom: candidateTop + panelHeight,
                };

                const overlayScore = overlayScoreForRect(rect, panel);
                const overlapsSelection = rectsOverlap(rect, anchorRect);
                const clampDistance = Math.abs(candidateLeft - raw.left) + Math.abs(candidateTop - raw.top);

                return {
                    left: candidateLeft,
                    top: candidateTop,
                    score:
                        overlayScore * 1000 +
                        (overlapsSelection ? 500 : 0) +
                        clampDistance * 0.05 +
                        preferenceIndex,
                };
            });

            candidates.sort((a, b) => a.score - b.score);
            left = candidates[0].left;
            top = candidates[0].top;
        } else {
            // Rare fallback for shadow-DOM selections without a usable range rect.
            left = (window.innerWidth - panelRect.width) / 2;
            top = Math.min(
                window.innerHeight * 0.3,
                window.innerHeight - panelRect.height - VIEWPORT_MARGIN
            );
        }

        left = clamp(
            left,
            VIEWPORT_MARGIN,
            Math.max(VIEWPORT_MARGIN, window.innerWidth - panelRect.width - VIEWPORT_MARGIN)
        );
        top = clamp(
            top,
            VIEWPORT_MARGIN,
            Math.max(VIEWPORT_MARGIN, window.innerHeight - panelRect.height - VIEWPORT_MARGIN)
        );

        panel.style.left = `${Math.round(left)}px`;
        panel.style.top = `${Math.round(top)}px`;
        panel.style.visibility = "visible";
    }, [currentSelectionRect, fallbackAnchorRect]);

    const copyTranslation = useCallback(async () => {
        const text = window.translateResult?.mainMeaning || "";
        if (!text) return;
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
                return;
            }
        } catch {
            // Fall through to the DOM copy fallback below.
        }

        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.documentElement.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
    }, []);

    useEffect(() => {
        const cancelers = [];

        channel.provide("check_availability", () => Promise.resolve());

        cancelers.push(
            channel.on("start_translating", (detail) => {
                if (!acceptTimestamp(detail.timestamp)) return;

                anchorRef.current = {
                    position: detail.position || anchorRef.current.position,
                    selectionHeight: detail.selectionHeight || anchorRef.current.selectionHeight,
                    originalText: detail.text || anchorRef.current.originalText,
                };
                window.translateResult.originalText = detail.text || "";
                window.isDisplayingResult = true;
                setView({ open: true, type: "LOADING", text: "", error: "" });
            })
        );

        cancelers.push(
            channel.on("translating_finished", (detail) => {
                if (!acceptTimestamp(detail.timestamp)) return;

                if (detail.position) anchorRef.current.position = detail.position;
                if (detail.selectionHeight) anchorRef.current.selectionHeight = detail.selectionHeight;
                if (detail.originalText) anchorRef.current.originalText = detail.originalText;

                window.translateResult = detail;
                window.isDisplayingResult = true;
                setView({
                    open: true,
                    type: "RESULT",
                    text: detail.mainMeaning || "",
                    error: "",
                });
            })
        );

        cancelers.push(
            channel.on("translating_error", (detail) => {
                if (!acceptTimestamp(detail.timestamp)) return;
                window.isDisplayingResult = true;
                setView({
                    open: true,
                    type: "ERROR",
                    text: "",
                    error: detail.message || detail.errorMsg || "翻译失败",
                });
            })
        );

        cancelers.push(
            channel.on("command", (detail) => {
                switch (detail.command) {
                    case "close_result_frame":
                        closePanel();
                        break;
                    case "copy_result":
                        copyTranslation();
                        break;
                    // Compact selection bubbles intentionally have no fixed/drag mode.
                    case "fix_result_frame":
                    default:
                        break;
                }
            })
        );

        return () => cancelers.forEach((cancel) => cancel?.());
    }, [acceptTimestamp, closePanel, copyTranslation]);

    useEffect(() => {
        if (!view.open) return undefined;

        let raf = requestAnimationFrame(positionPanel);
        const delayedRepositions = [70, 180, 420].map((delay) =>
            window.setTimeout(() => {
                cancelAnimationFrame(raf);
                raf = requestAnimationFrame(positionPanel);
            }, delay)
        );

        const reposition = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(positionPanel);
        };
        const onPointerDown = (event) => {
            const path = event.composedPath?.() || [];
            if (panelRef.current && !path.includes(panelRef.current)) closePanel();
        };
        const onKeyDown = (event) => {
            if (event.key === "Escape") closePanel();
        };

        window.addEventListener("resize", reposition);
        window.addEventListener("scroll", reposition, true);
        document.addEventListener("mousedown", onPointerDown, true);
        document.addEventListener("keydown", onKeyDown, true);

        return () => {
            cancelAnimationFrame(raf);
            delayedRepositions.forEach((timer) => window.clearTimeout(timer));
            window.removeEventListener("resize", reposition);
            window.removeEventListener("scroll", reposition, true);
            document.removeEventListener("mousedown", onPointerDown, true);
            document.removeEventListener("keydown", onKeyDown, true);
        };
    }, [closePanel, positionPanel, view.open, view.type, view.text, view.error]);

    if (!view.open) return null;

    const content =
        view.type === "LOADING"
            ? "翻译中…"
            : view.type === "ERROR"
              ? view.error || "翻译失败"
              : view.text;

    return (
        <root.div>
            <Bubble ref={panelRef} role="dialog" aria-live="polite" data-state={view.type}>
                <TranslationText>{content}</TranslationText>
                {view.type === "RESULT" && view.text && (
                    <IconButton role="button" title="复制译文" onClick={copyTranslation}>
                        <CopyIcon />
                    </IconButton>
                )}
                <IconButton role="button" title="关闭" onClick={closePanel}>
                    <CloseIcon />
                </IconButton>
            </Bubble>
        </root.div>
    );
}

const Bubble = styled.div`
    position: fixed;
    top: 0;
    left: 0;
    visibility: hidden;
    z-index: ${MAX_Z_INDEX};
    display: inline-flex;
    align-items: flex-start;
    gap: 5px;
    width: max-content;
    min-width: 44px;
    max-width: min(430px, calc(100vw - 16px));
    box-sizing: border-box;
    padding: 9px 8px 9px 12px;
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 11px;
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 8px 28px rgba(31, 41, 55, 0.18), 0 2px 7px rgba(31, 41, 55, 0.08);
    color: #1f2430;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 14px;
    line-height: 1.45;
    -webkit-text-size-adjust: 100%;
    backdrop-filter: blur(14px);
`;

const TranslationText = styled.div`
    flex: 0 1 auto;
    min-width: 0;
    max-width: 355px;
    padding: 1px 2px 1px 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: normal;
    font-weight: 500;
    line-height: 1.45;
`;

const IconButton = styled.button`
    flex: 0 0 auto;
    width: 22px;
    height: 22px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 7px;
    background: transparent;
    cursor: pointer;
    opacity: 0.62;

    svg {
        display: block;
        width: 14px;
        height: 14px;
        fill: #5f6368;
    }

    &:hover {
        opacity: 1;
        background: rgba(0, 0, 0, 0.06);
    }
`;
