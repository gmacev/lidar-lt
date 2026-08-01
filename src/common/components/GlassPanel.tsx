import { forwardRef, type ReactNode } from 'react';

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
    children: ReactNode;
    className?: string;
    variant?: 'viewer' | 'themed';
}

export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(function GlassPanel(
    { children, className = '', variant = 'viewer', ...props },
    ref
) {
    const variantClassName =
        variant === 'themed'
            ? 'border-panel-border bg-panel-bg text-panel-text'
            : 'theme-surface border-glass-border bg-glass-bg';

    return (
        <div
            ref={ref}
            className={`
        rounded-lg
        border
        p-2
        ${variantClassName}
        ${className}
      `}
            {...props}
        >
            {children}
        </div>
    );
});
