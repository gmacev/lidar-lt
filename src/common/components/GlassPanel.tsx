import type { ReactNode } from 'react';

interface GlassPanelProps {
    children: ReactNode;
    className?: string;
}

export function GlassPanel({ children, className = '' }: GlassPanelProps) {
    return (
        <div
            className={`
        rounded-lg
        border border-glass-border
        bg-glass-bg
        backdrop-blur-xl
        p-2
        ${className}
      `}
        >
            {children}
        </div>
    );
}
