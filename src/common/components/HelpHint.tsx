import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { FloatingPopover } from './FloatingPopover';
import { Icon } from './Icon';

interface HelpHintProps {
    align?: 'start' | 'center' | 'end';
    ariaLabel?: string;
    children: ReactNode;
    className?: string;
    iconClassName?: string;
    popoverClassName?: string;
    side?: 'top' | 'right' | 'bottom' | 'left';
    title?: ReactNode;
    trigger?: ReactNode;
    width?: number;
}

export function HelpHint({
    align = 'center',
    ariaLabel = 'Show help',
    children,
    className = '',
    iconClassName = '',
    popoverClassName = '',
    side = 'right',
    title,
    trigger,
    width = 260,
}: HelpHintProps) {
    const id = useId();
    const triggerRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const closeTimerRef = useRef<number | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [isPinnedOpen, setIsPinnedOpen] = useState(false);

    const clearCloseTimer = () => {
        if (closeTimerRef.current === null) return;

        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
    };

    const open = () => {
        clearCloseTimer();
        setIsOpen(true);
    };

    const close = () => {
        if (isPinnedOpen) return;

        clearCloseTimer();
        closeTimerRef.current = window.setTimeout(() => setIsOpen(false), 80);
    };

    const closePinned = () => {
        clearCloseTimer();
        setIsPinnedOpen(false);
        setIsOpen(false);
    };

    const handleClick = () => {
        clearCloseTimer();
        setIsPinnedOpen((current) => {
            const next = !current;
            setIsOpen(next);
            return next;
        });
    };

    useEffect(() => clearCloseTimer, []);

    useEffect(() => {
        if (!isOpen) return;

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) return;

            const trigger = triggerRef.current;
            const popover = popoverRef.current;

            if (trigger?.contains(target) || popover?.contains(target)) return;

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
    }, [id, isOpen]);

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                className={`group/help flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.025] text-[10px] font-bold text-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all duration-200 hover:border-neon-cyan/45 hover:bg-neon-cyan/10 hover:text-neon-cyan focus-visible:border-neon-cyan focus-visible:text-neon-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/30 ${className}`}
                aria-describedby={isOpen ? id : undefined}
                aria-label={ariaLabel}
                onBlur={close}
                onClick={handleClick}
                onFocus={open}
                onMouseEnter={open}
                onMouseLeave={close}
            >
                {trigger ?? (
                    <Icon
                        name="question"
                        size={13}
                        strokeWidth={2.8}
                        className={`transition-transform duration-200 group-hover/help:scale-110 ${iconClassName}`}
                    />
                )}
            </button>

            <FloatingPopover
                ref={popoverRef}
                id={id}
                role="tooltip"
                anchorRef={triggerRef}
                align={align}
                isOpen={isOpen}
                side={side}
                width={width}
                className={`rounded-lg border border-white/10 bg-void-black/90 px-3 py-2.5 text-[13px] leading-snug text-white/75 shadow-[0_18px_50px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.08)] ${popoverClassName}`}
                onMouseEnter={open}
                onMouseLeave={close}
            >
                {title && (
                    <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-white/95">
                        {title}
                    </div>
                )}
                <div>{children}</div>
            </FloatingPopover>
        </>
    );
}
