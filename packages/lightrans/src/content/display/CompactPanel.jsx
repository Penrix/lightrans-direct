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

window.translateResult = window.translateResult || {};
window.isDisplayingResult = false;

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
            const anchorCenter = anchor.left + (anchor.width || 0) / 2;
            left = anchorCenter - panelRect.width / 2;

            // Prefer above the selection. Flip below only when there is not enough room.
            top = anchor.top - panelRect.height - ANCHOR_GAP;
            if (top < VIEWPORT_MARGIN) {
                top = anchor.bottom + ANCHOR_GAP;
            }
        } else {
            // Rare fallback for shadow-DOM selections without a usable range rect.
            left = (window.innerWidth - panelRect.width) / 2;
            top = Math.min(window.innerHeight * 0.3, window.innerHeight - panelRect.height - VIEWPORT_MARGIN);
        }

        left = Math.max(
            VIEWPORT_MARGIN,
            Math.min(left, window.innerWidth - panelRect.width - VIEWPORT_MARGIN)
        );
        top = Math.max(
            VIEWPORT_MARGIN,
            Math.min(top, window.innerHeight - panelRect.height - VIEWPORT_MARGIN)
        );

        panel.style.left = `${Math.round(left)}px`;
        panel.style.top = `${Math.round(top)}px`;
        panel.style.visibility = "visible";
    }, [currentSelectionRect, fallbackAnchorRect]);

    const copyTranslation = useCallback(async () => {
        const text = view.text || "";
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
    }, [view.text]);

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
