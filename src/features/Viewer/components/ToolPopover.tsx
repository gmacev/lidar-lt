import type { ReactNode, RefObject } from 'react';
import { Popover } from '@/common/components';

interface ToolPopoverProps {
    anchorRef: RefObject<HTMLElement | null>;
    children: ReactNode;
    className?: string;
    isOpen: boolean;
    width: number;
}

export function ToolPopover({
    anchorRef,
    children,
    className = '',
    isOpen,
    width,
}: ToolPopoverProps) {
    return (
        <Popover
            anchorRef={anchorRef}
            isOpen={isOpen}
            width={width}
            side="left"
            align="start"
            className={className}
        >
            {children}
        </Popover>
    );
}
