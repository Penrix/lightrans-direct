/** @jsx h */
import { h } from "preact";
import SuccessIcon from "./icons/success.svg";
import InfoIcon from "./icons/info.svg";
import WarningIcon from "./icons/warning.svg";
import ErrorIcon from "./icons/error.svg";
import CloseIcon from "./icons/close.svg";

/**
 * @param {{
 *   type: "success" | "info" | "warning" | "error",
 *   title: string,
 *   detail: string?,
 *   closeIcon: boolean,
 *   duration: number,
 * }} props notification content
 * @returns {h.JSX.Element} element
 */
export default function NotifierTemplate(props) {
    return (
        <div
            class={`lightrans-notifier-item lightrans-notifier-show-animation lightrans-notifier-${props.type}`}
        >
            <div class="lightrans-notifier-icon">
                {props.type === "success" && <SuccessIcon />}
                {props.type === "info" && <InfoIcon />}
                {props.type === "warning" && <WarningIcon />}
                {props.type === "error" && <ErrorIcon />}
            </div>
            <div class="lightrans-notifier-content">
                <div class="lightrans-notifier-title">{props.title}</div>
                <div class="lightrans-notifier-detail">{props.detail}</div>
            </div>
            <div class="lightrans-notifier-close">
                {(props.closeIcon || props.duration <= 0) && <CloseIcon />}
            </div>
        </div>
    );
}
