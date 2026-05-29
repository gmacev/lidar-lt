import type { ReactNode, RefObject } from 'react';
import { FloatingPopover } from '@/common/components';

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
        <FloatingPopover
            anchorRef={anchorRef}
            isOpen={isOpen}
            width={width}
            side="left"
            align="start"
            className={className}
        >
            {children}
        </FloatingPopover>
    );
}
