import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

interface ToolPopoverProps {
    anchorRef: RefObject<HTMLElement | null>;
    children: ReactNode;
    className?: string;
    isOpen: boolean;
    width: number;
}

const VIEWPORT_PADDING = 8;
const TRIGGER_GAP = 12;

export function ToolPopover({
    anchorRef,
    children,
    className = '',
    isOpen,
    width,
}: ToolPopoverProps) {
    const popoverRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ left: 0, top: 0, width });

    useEffect(() => {
        if (!isOpen) return;

        const updatePosition = () => {
            const anchor = anchorRef.current;
            if (!anchor) return;

            const rect = anchor.getBoundingClientRect();
            const availableWidth = Math.max(0, rect.left - TRIGGER_GAP - VIEWPORT_PADDING);
            const panelWidth = Math.min(width, availableWidth);
            const left = Math.max(VIEWPORT_PADDING, rect.left - TRIGGER_GAP - panelWidth);
            const panelHeight = popoverRef.current?.getBoundingClientRect().height ?? 0;
            const maxTop = Math.max(
                VIEWPORT_PADDING,
                window.innerHeight - panelHeight - VIEWPORT_PADDING
            );
            const top = Math.min(Math.max(VIEWPORT_PADDING, rect.top), maxTop);

            setPosition({ left, top, width: panelWidth });
        };

        const frame = requestAnimationFrame(updatePosition);
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);

        const resizeObserver = new ResizeObserver(updatePosition);
        if (popoverRef.current) resizeObserver.observe(popoverRef.current);

        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
            resizeObserver.disconnect();
        };
    }, [anchorRef, isOpen, width]);

    if (!isOpen) return null;

    return createPortal(
        <div
            ref={popoverRef}
            className={`fixed z-50 ${className}`}
            style={{
                left: position.left,
                top: position.top,
                width: position.width,
            }}
        >
            {children}
        </div>,
        document.body
    );
}
