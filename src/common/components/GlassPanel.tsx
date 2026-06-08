import { forwardRef, type ReactNode } from 'react';

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
    children: ReactNode;
    className?: string;
}

export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(function GlassPanel(
    { children, className = '', ...props },
    ref
) {
    return (
        <div
            ref={ref}
            className={`
        rounded-lg
        border border-glass-border
        bg-glass-bg
        p-2
        ${className}
      `}
            {...props}
        >
            {children}
        </div>
    );
});
