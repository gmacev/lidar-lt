import {
    forwardRef,
    useEffect,
    useId,
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

interface PopoverProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
    align?: PopoverAlign;
    anchorRef?: RefObject<HTMLElement | null>;
    children: ReactNode;
    gap?: number;
    isOpen?: boolean;
    onTriggerClick?: () => void;
    side?: PopoverSide;
    trigger?: ReactNode;
    triggerAriaLabel?: string;
    triggerClassName?: string;
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

export const Popover = forwardRef<HTMLDivElement, PopoverProps>(function Popover(
    {
        align = 'start',
        anchorRef,
        children,
        className = '',
        gap = DEFAULT_GAP,
        isOpen: controlledIsOpen,
        onTriggerClick,
        side = 'right',
        style,
        trigger,
        triggerAriaLabel,
        triggerClassName = '',
        viewportPadding = DEFAULT_VIEWPORT_PADDING,
        width,
        ...props
    },
    ref
) {
    const id = useId();
    const internalAnchorRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const closeTimerRef = useRef<number | null>(null);
    const [internalIsOpen, setInternalIsOpen] = useState(false);
    const [isPinnedOpen, setIsPinnedOpen] = useState(false);
    const [position, setPosition] = useState<CSSProperties>({
        left: 0,
        top: 0,
        visibility: 'hidden',
        width,
    });
    const resolvedAnchorRef = anchorRef ?? internalAnchorRef;
    const isControlled = controlledIsOpen !== undefined;
    const isOpen = controlledIsOpen ?? internalIsOpen;

    useImperativeHandle(ref, () => panelRef.current as HTMLDivElement);

    const clearCloseTimer = () => {
        if (closeTimerRef.current === null) return;
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
    };

    const open = () => {
        if (isControlled) return;
        clearCloseTimer();
        setInternalIsOpen(true);
    };

    const close = () => {
        if (isControlled || isPinnedOpen) return;
        clearCloseTimer();
        closeTimerRef.current = window.setTimeout(() => setInternalIsOpen(false), 80);
    };

    const closePinned = () => {
        if (isControlled) return;
        clearCloseTimer();
        setIsPinnedOpen(false);
        setInternalIsOpen(false);
    };

    const handleTriggerClick = () => {
        onTriggerClick?.();
        if (isControlled) return;

        clearCloseTimer();
        setIsPinnedOpen((current) => {
            const next = !current;
            setInternalIsOpen(next);
            return next;
        });
    };

    useEffect(() => clearCloseTimer, []);

    useEffect(() => {
        if (!isOpen || isControlled) return;

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) return;
            if (resolvedAnchorRef.current?.contains(target) || panelRef.current?.contains(target)) {
                return;
            }
            closePinned();
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') closePinned();
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isControlled, isOpen, resolvedAnchorRef]);

    useEffect(() => {
        if (!isOpen) return;

        const updatePosition = () => {
            const anchor = resolvedAnchorRef.current;
            if (!anchor) return;

            const anchorRect = anchor.getBoundingClientRect();
            const panelRect = panelRef.current?.getBoundingClientRect();
            const panelWidth = width ?? panelRect?.width ?? 0;
            const panelHeight = panelRect?.height ?? 0;
            const maxLeft = Math.max(
                viewportPadding,
                window.innerWidth - panelWidth - viewportPadding
            );
            const maxTop = Math.max(
                viewportPadding,
                window.innerHeight - panelHeight - viewportPadding
            );

            let left = anchorRect.right + gap;
            let top = getCrossAxisPosition(anchorRect.top, anchorRect.height, panelHeight, align);

            if (side === 'left') {
                const availableWidth = Math.max(0, anchorRect.left - gap - viewportPadding);
                const resolvedPanelWidth = Math.min(panelWidth, availableWidth || panelWidth);
                const resolvedWidth = width ? Math.min(width, availableWidth || width) : undefined;

                left = anchorRect.left - gap - resolvedPanelWidth;
                setPosition({
                    left: Math.max(viewportPadding, left),
                    top: clamp(top, viewportPadding, maxTop),
                    visibility: 'visible',
                    width: resolvedWidth,
                    maxWidth: availableWidth || undefined,
                });
                return;
            }

            if (side === 'top' || side === 'bottom') {
                left = getCrossAxisPosition(anchorRect.left, anchorRect.width, panelWidth, align);
                top = side === 'top' ? anchorRect.top - gap - panelHeight : anchorRect.bottom + gap;
            }

            setPosition({
                left: clamp(left, viewportPadding, maxLeft),
                top: clamp(top, viewportPadding, maxTop),
                visibility: 'visible',
                width,
            });
        };

        setPosition((current) => ({ ...current, visibility: 'hidden' }));
        updatePosition();
        window.addEventListener('resize', updatePosition);
        const handleScroll = (event: Event) => {
            const target = event.target;
            if (target instanceof Node && panelRef.current?.contains(target)) return;
            updatePosition();
        };

        window.addEventListener('scroll', handleScroll, true);
        const resizeObserver = new ResizeObserver(updatePosition);
        if (panelRef.current) resizeObserver.observe(panelRef.current);

        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', handleScroll, true);
            resizeObserver.disconnect();
        };
    }, [align, children, gap, isOpen, resolvedAnchorRef, side, viewportPadding, width]);

    return (
        <>
            {trigger !== undefined && (
                <button
                    ref={internalAnchorRef}
                    type="button"
                    className={triggerClassName}
                    aria-describedby={isOpen ? id : undefined}
                    aria-label={triggerAriaLabel}
                    onBlur={close}
                    onClick={handleTriggerClick}
                    onFocus={open}
                    onMouseEnter={open}
                    onMouseLeave={close}
                >
                    {trigger}
                </button>
            )}

            {isOpen &&
                createPortal(
                    <div
                        ref={panelRef}
                        id={id}
                        className={`fixed z-50 ${className}`}
                        style={{ ...position, ...style }}
                        onMouseEnter={open}
                        onMouseLeave={close}
                        {...props}
                    >
                        {children}
                    </div>,
                    document.body
                )}
        </>
    );
});
