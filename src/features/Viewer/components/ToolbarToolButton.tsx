import { forwardRef, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Popover } from '@/common/components';

interface ToolbarToolButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
    activeClassName?: string;
    icon: ReactNode;
    isActive: boolean;
    label: string;
}

export const ToolbarToolButton = forwardRef<HTMLButtonElement, ToolbarToolButtonProps>(
    function ToolbarToolButton(
        { activeClassName, className = '', icon, isActive, label, onClick, ...props },
        ref
    ) {
        const buttonRef = useRef<HTMLButtonElement>(null);
        const [isPopoverOpen, setIsPopoverOpen] = useState(false);
        const resolvedActiveClassName =
            activeClassName ??
            'bg-neon-amber/30 border-neon-amber text-neon-amber shadow-[0_0_6px_rgba(255,191,0,0.22)]';

        const setButtonRef = (element: HTMLButtonElement | null) => {
            buttonRef.current = element;

            if (typeof ref === 'function') {
                ref(element);
            } else if (ref) {
                ref.current = element;
            }
        };

        return (
            <>
                <button
                    {...props}
                    ref={setButtonRef}
                    type="button"
                    aria-label={label}
                    className={`flex h-10 w-10 items-center justify-center rounded-lg border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-amber/70 ${
                        isActive
                            ? resolvedActiveClassName
                            : 'bg-glass-bg border-white/10 text-white/70 hover:text-neon-amber hover:border-neon-amber/50 hover:bg-black/95'
                    } ${className}`}
                    onBlur={() => setIsPopoverOpen(false)}
                    onClick={(event) => {
                        setIsPopoverOpen(false);
                        onClick?.(event);
                    }}
                    onFocus={() => setIsPopoverOpen(true)}
                    onMouseEnter={() => setIsPopoverOpen(true)}
                    onMouseLeave={() => setIsPopoverOpen(false)}
                >
                    {icon}
                </button>

                <Popover
                    anchorRef={buttonRef}
                    isOpen={isPopoverOpen}
                    side="left"
                    align="center"
                    gap={8}
                    role="tooltip"
                    className="pointer-events-none w-max rounded-md border border-white/10 bg-black/95 px-2.5 py-1.5 text-xs font-medium leading-snug text-white/90 shadow-lg"
                >
                    {label}
                </Popover>
            </>
        );
    }
);
