import type { ReactNode } from 'react';

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
    children: ReactNode;
    className?: string;
}

export function GlassPanel({ children, className = '', ...props }: GlassPanelProps) {
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
            {...props}
        >
            {children}
        </div>
    );
}
