/** @jsx h */
import { h, cloneElement } from "preact";
import { forwardRef } from "preact/compat";
import { useState, useRef, useCallback, useEffect } from "preact/hooks";
import styled, { css } from "styled-components";
import ArrowDownIcon from "./icons/arrow-down.svg";

/**
 *
 * @param {{
 *   className?: string;
 *   title: string; // Menu defaults to display content.
 *   activeKey?: any; // Similar to the value property of select element.
 *   onSelect?: (eventKey: any, event: MouseEvent) => void; // Selected callback function.
 *   onOpen?: ()=>void; // Menu Pop-up callback function
 *   onClose?: ()=>void; // The callback function that the menu closes.
 *   children?: h.JSX.Element;
 * }} props
 * @returns {h.JSX.Element} element
 */
const Dropdown = forwardRef((props, ref) => {
    const [open, setOpen] = useState(false);
    const titleElRef = useRef();
    const clickAwayHandler = useCallback((event) => {
        // Chrome has the "path" property and Firefox has the "composedPath" function.
        const path = event.path || (event.composedPath && event.composedPath());
        if (!titleElRef.current.contains(path[0])) {
            setOpen(false);
            window.removeEventListener("click", clickAwayHandler);
        }
    }, []);
    const Items = props.children?.map((child) =>
        cloneElement(child, {
            active: child.props.eventKey === props.activeKey,
            onSelect: (eventKey, event) => {
                if (eventKey !== props.activeKey) props.onSelect && props.onSelect(eventKey, event);
            },
        })
    );
    useEffect(() => {
        return () => window.removeEventListener("click", clickAwayHandler);
    }, [clickAwayHandler]);

    return (
        <StyledSelect className={props.className} ref={ref}>
            <Title
                ref={titleElRef}
                onClick={() => {
                    if (!open) {
                        window.addEventListener("click", clickAwayHandler);
                        props.onOpen && props.onOpen();
                    } else props.onClose && props.onClose();
                    setOpen(!open);
                }}
            >
                {props.title}
                <StyledArrowDownIcon />
            </Title>
            <Menu open={open}>{Items}</Menu>
        </StyledSelect>
    );
});
Dropdown.displayName = "Dropdown";

/**
 *
 * @param {{
 *   className?: string;
 *   eventKey: any; // The value of the current option.
 *   active: boolean; // Active the current option.
 *   onSelect: (eventKey: any, event: MouseEvent) => void; // Select the callback function for the current option.
 *   children?: h.JSX.Element;
 * }} props
 * @returns {h.JSX.Element} element
 */
Dropdown.Item = function DropdownItem(props) {
    return (
        <Item
            role="menuitem"
            className={props.className}
            active={props.active}
            onClick={(event) => {
                props.onSelect && props.onSelect(props.eventKey, event);
            }}
        >
            {props.children}
        </Item>
    );
};
export default Dropdown;

/**
 * STYLE FOR THE COMPONENT START
 */
const ColorPrimary = "#4a8cf7";
const StyledSelect = styled.div`
    position: relative;
    display: flex;
    align-items: center;
    font-size: 0;
`;
const Menu = styled.ul`
    display: ${(props) => (props.open ? "block" : "none")};
    min-width: 120px;
    margin: 4px 0 0;
    list-style: none;
    font-size: 14px;
    text-align: left;
    background-color: rgba(255, 255, 255, 0.96);
    -webkit-backdrop-filter: blur(12px);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(0, 0, 0, 0.06);
    border-radius: 10px;
    padding: 6px;
    position: absolute;
    left: 0;
    top: 100%;
    z-index: 6;
    float: left;
    box-shadow: 0 12px 32px rgba(31, 41, 55, 0.18);
`;
const Title = styled.a`
    display: flex;
    align-items: center;
    margin-bottom: 0;
    font-weight: 500;
    text-align: center;
    cursor: pointer;
    outline: 0;
    white-space: nowrap;
    border: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
    padding: 4px 10px;
    font-size: 14px;
    line-height: 1.5;
    border-radius: 8px;
    transition: color 0.2s linear, background-color 0.2s linear;
    color: #1f2430;
    background-color: rgba(0, 0, 0, 0.04);
    overflow: hidden;
    &:hover {
        color: ${ColorPrimary};
        background: rgba(74, 140, 247, 0.1);
    }
    &:hover svg {
        fill: ${ColorPrimary};
    }
`;
const StyledArrowDownIcon = styled(ArrowDownIcon)`
    fill: #5f6368;
    margin-left: 4px;
    transition: fill 0.2s linear;
`;

/* Style of Item */
const ActiveStyle = css`
    color: #4a8cf7;
    font-weight: 700;
    background-color: rgba(74, 140, 247, 0.1);
    border-radius: 6px;
    &:hover {
        color: #4a8cf7;
        background-color: rgba(74, 140, 247, 0.1);
    }
`;
const InActiveStyle = css`
    color: #3c4250;
    border-radius: 6px;
    &:hover {
        color: #3c4250;
        background-color: rgba(0, 0, 0, 0.05);
    }
`;
const Item = styled.li`
    display: flex;
    padding: 8px 12px;
    clear: both;
    font-weight: 400;
    line-height: 1.4;
    white-space: nowrap;
    cursor: pointer;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
    -webkit-transition: color 0.2s linear, background-color 0.2s linear;
    transition: color 0.2s linear, background-color 0.2s linear;
    ${(props) => (props.active ? ActiveStyle : InActiveStyle)}
`;
/**
 * STYLE FOR THE COMPONENT END
 */
