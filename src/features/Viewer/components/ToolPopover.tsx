import type { ReactNode, RefObject } from 'react';
import { Popover } from '@/common/components';

interface ToolPopoverProps {
    anchorRef: RefObject<HTMLElement | null>;
    children: ReactNode;
    className?: string;
    isOpen: boolean;
    testId?: string;
    width: number;
}

export function ToolPopover({
    anchorRef,
    children,
    className = '',
    isOpen,
    testId,
    width,
}: ToolPopoverProps) {
    return (
        <Popover
            anchorRef={anchorRef}
            data-testid={testId}
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
