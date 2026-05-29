import {
    forwardRef,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
    type CSSProperties,
    type HTMLAttributes,
    type ReactNode,
    type RefObject,
} from 'react';
import { createPortal } from 'react-dom';

type PopoverSide = 'top' | 'right' | 'bottom' | 'left';
type PopoverAlign = 'start' | 'center' | 'end';

interface FloatingPopoverProps extends HTMLAttributes<HTMLDivElement> {
    anchorRef: RefObject<HTMLElement | null>;
    align?: PopoverAlign;
    children: ReactNode;
    gap?: number;
    isOpen: boolean;
    side?: PopoverSide;
    viewportPadding?: number;
    width?: number;
}

const DEFAULT_GAP = 12;
const DEFAULT_VIEWPORT_PADDING = 8;

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function getCrossAxisPosition(
    anchorStart: number,
    anchorSize: number,
    panelSize: number,
    align: PopoverAlign
) {
    if (align === 'center') return anchorStart + anchorSize / 2 - panelSize / 2;
    if (align === 'end') return anchorStart + anchorSize - panelSize;
    return anchorStart;
}

export const FloatingPopover = forwardRef<HTMLDivElement, FloatingPopoverProps>(
    function FloatingPopover(
        {
            anchorRef,
            align = 'start',
            children,
            className = '',
            gap = DEFAULT_GAP,
            isOpen,
            side = 'right',
            style,
            viewportPadding = DEFAULT_VIEWPORT_PADDING,
            width,
            ...props
        },
        ref
    ) {
        const popoverRef = useRef<HTMLDivElement>(null);
        const [position, setPosition] = useState<CSSProperties>({
            left: 0,
            top: 0,
            width,
        });

        useImperativeHandle(ref, () => popoverRef.current as HTMLDivElement);

        useEffect(() => {
            if (!isOpen) return;

            const updatePosition = () => {
                const anchor = anchorRef.current;
                if (!anchor) return;

                const anchorRect = anchor.getBoundingClientRect();
                const popoverRect = popoverRef.current?.getBoundingClientRect();
                const panelWidth = width ?? popoverRect?.width ?? 0;
                const panelHeight = popoverRect?.height ?? 0;
                const maxLeft = Math.max(
                    viewportPadding,
                    window.innerWidth - panelWidth - viewportPadding
                );
                const maxTop = Math.max(
                    viewportPadding,
                    window.innerHeight - panelHeight - viewportPadding
                );

                let left = anchorRect.right + gap;
                let top = getCrossAxisPosition(
                    anchorRect.top,
                    anchorRect.height,
                    panelHeight,
                    align
                );

                if (side === 'left') {
                    const availableWidth = Math.max(0, anchorRect.left - gap - viewportPadding);
                    const resolvedWidth = width
                        ? Math.min(width, availableWidth || width)
                        : panelWidth;

                    left = anchorRect.left - gap - resolvedWidth;
                    top = getCrossAxisPosition(
                        anchorRect.top,
                        anchorRect.height,
                        panelHeight,
                        align
                    );

                    setPosition({
                        left: Math.max(viewportPadding, left),
                        top: clamp(top, viewportPadding, maxTop),
                        width: resolvedWidth,
                    });
                    return;
                }

                if (side === 'top' || side === 'bottom') {
                    left = getCrossAxisPosition(
                        anchorRect.left,
                        anchorRect.width,
                        panelWidth,
                        align
                    );
                    top =
                        side === 'top'
                            ? anchorRect.top - gap - panelHeight
                            : anchorRect.bottom + gap;
                }

                setPosition({
                    left: clamp(left, viewportPadding, maxLeft),
                    top: clamp(top, viewportPadding, maxTop),
                    width,
                });
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
        }, [align, anchorRef, gap, isOpen, side, viewportPadding, width]);

        if (!isOpen) return null;

        return createPortal(
            <div
                ref={popoverRef}
                className={`fixed z-50 ${className}`}
                style={{ ...position, ...style }}
                {...props}
            >
                {children}
            </div>,
            document.body
        );
    }
);
