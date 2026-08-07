/** @jsx h */
import { h } from "preact";
import styled from "styled-components";
import { useEffect, useRef } from "preact/hooks";
import { ContentWrapperCenterClassName } from "./Panel.jsx";
import ErrorIcon from "./icons/error.svg";

/**
 * @param {{
 *   error: {
 *     errorType: "API_ERR" | "NET_ERR",
 *     errorCode: Number,
 *     errorMsg: string,
 *     errorAct: Object?,
 *   }
 * }} props error info
 *
 * @returns {h.JSX.Element} element
 */
export default function Error(props) {
    const errorElRef = useRef();
    /**
     * To align the error content align in the vertical center.
     */
    useEffect(() => {
        const wrapperElement = errorElRef.current.parentElement.parentElement;
        wrapperElement.classList.add(ContentWrapperCenterClassName);
        return () => {
            wrapperElement.classList.remove(ContentWrapperCenterClassName);
        };
    }, []);
    return (
        <ErrorContainer ref={errorElRef}>
            <ErrorInfo>
                <StyledErrorIcon />
                <ErrorType>
                    {props.error.errorType === "API_ERR"
                        ? chrome.i18n.getMessage("APIERR")
                        : chrome.i18n.getMessage("NETERR")}
                </ErrorType>
                <ErrorMessage>
                    {`${chrome.i18n.getMessage("ERR_CODE")}: ${JSON.stringify(
                        props.error.errorCode
                    )}`}
                </ErrorMessage>
                <ErrorMessage>
                    {`${chrome.i18n.getMessage("ERR_MSG")}: ${JSON.stringify(
                        props.error.errorMsg
                    )}`}
                </ErrorMessage>
                {props.error.errorAct && (
                    <ErrorMessage>
                        {`${chrome.i18n.getMessage("ERR_ACT")}: ${JSON.stringify(
                            props.error.errorAct
                        )}`}
                    </ErrorMessage>
                )}
            </ErrorInfo>
        </ErrorContainer>
    );
}

const ErrorContainer = styled.div`
    height: 100%;
    display: flex;
    flex-direction: column;

    // "justify-content: center;" may cause part of content hidden when overflowing, so we use pseudo elements to simulate its effect.
    &::before,
    &::after {
        content: "";
        flex: 1;
    }
`;

const ErrorInfo = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    margin: 8% 6%;
    padding: 20px 16px;
    background: rgba(255, 255, 255, 0.82);
    border: 1px solid rgba(0, 0, 0, 0.06);
    border-radius: 12px;
`;

const StyledErrorIcon = styled(ErrorIcon)`
    width: 88px;
    height: 88px;
    display: block;
    margin-bottom: 8px;
    fill: #ef4444;
`;

const ErrorType = styled.p`
    font-weight: 700;
    font-size: large;
    color: #ef4444;
    margin: 4px 0;
`;

const ErrorMessage = styled.p`
    color: #5f6675;
    font-size: small;
    margin: 2px 0;
    word-break: break-word;
`;
