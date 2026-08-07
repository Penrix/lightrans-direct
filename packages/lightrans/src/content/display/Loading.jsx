/** @jsx h */
import { h } from "preact";
import { useEffect, useRef } from "preact/hooks";
import styled from "styled-components";
import { ContentWrapperCenterClassName } from "./Panel.jsx";

export default function Loading() {
    const loadingElRef = useRef();
    /**
     * To align the loading animation align in the vertical center.
     */
    useEffect(() => {
        const wrapperElement = loadingElRef.current.parentElement.parentElement;
        wrapperElement.classList.add(ContentWrapperCenterClassName);
        return () => {
            wrapperElement.classList.remove(ContentWrapperCenterClassName);
        };
    }, []);
    return (
        <LoadingEffect ref={loadingElRef}>
            <div class="lds-ellipsis">
                <div>
                    <div />
                </div>
                <div>
                    <div />
                </div>
                <div>
                    <div />
                </div>
                <div>
                    <div />
                </div>
                <div>
                    <div />
                </div>
            </div>
        </LoadingEffect>
    );
}

const LoadingEffect = styled.div`
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;

    .lds-ellipsis {
        width: auto !important;
        height: auto !important;
        transform: none !important;
        position: relative;
        display: flex;
        gap: 8px;
        align-items: center;
    }

    .lds-ellipsis > div {
        position: relative !important;
        transform: none !important;
        width: 10px;
        height: 10px;
    }

    .lds-ellipsis div > div {
        position: relative !important;
        top: auto !important;
        left: auto !important;
        width: 10px !important;
        height: 10px !important;
        border-radius: 50%;
        background: #4a8cf7;
        animation: lt-pulse 1.4s ease-in-out infinite;
    }

    .lds-ellipsis > div:nth-child(1) div {
        animation-delay: 0s;
    }
    .lds-ellipsis > div:nth-child(2) div {
        animation-delay: 0.18s;
    }
    .lds-ellipsis > div:nth-child(3) div {
        animation-delay: 0.36s;
    }
    .lds-ellipsis > div:nth-child(4) div {
        animation-delay: 0.54s;
    }
    .lds-ellipsis > div:nth-child(5) div {
        animation-delay: 0.72s;
    }

    @keyframes lt-pulse {
        0%,
        80%,
        100% {
            transform: scale(0.4);
            opacity: 0.4;
        }
        40% {
            transform: scale(1);
            opacity: 1;
        }
    }
`;
