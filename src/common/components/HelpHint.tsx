import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { Popover } from './Popover';

interface HelpHintProps {
    align?: 'start' | 'center' | 'end';
    ariaLabel?: string;
    children: ReactNode;
    className?: string;
    iconClassName?: string;
    popoverClassName?: string;
    side?: 'top' | 'right' | 'bottom' | 'left';
    title?: ReactNode;
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
    width = 260,
}: HelpHintProps) {
    return (
        <Popover
            align={align}
            className={`rounded-lg border border-white/10 bg-void-black/90 px-3 py-2.5 text-[13px] leading-snug text-white/75 shadow-[0_18px_50px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.08)] ${popoverClassName}`}
            role="tooltip"
            side={side}
            trigger={
                <Icon
                    name="question"
                    size={13}
                    strokeWidth={2.8}
                    className={`transition-transform duration-200 group-hover/help:scale-110 ${iconClassName}`}
                />
            }
            triggerAriaLabel={ariaLabel}
            triggerClassName={`group/help flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.025] text-[10px] font-bold text-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all duration-200 hover:border-neon-cyan/45 hover:bg-neon-cyan/10 hover:text-neon-cyan focus-visible:border-neon-cyan focus-visible:text-neon-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/30 ${className}`}
            width={width}
        >
            {title && (
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-white/95">
                    {title}
                </div>
            )}
            {children}
        </Popover>
    );
}
