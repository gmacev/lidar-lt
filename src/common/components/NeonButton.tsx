import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface NeonButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    children: ReactNode;
    variant?: 'amber' | 'green' | 'red';
}

const variantStyles = {
    amber: 'text-neon-amber shadow-neon-amber/30 hover:shadow-neon-amber/60 hover:bg-neon-amber/10',
    green: 'text-laser-green shadow-laser-green/30 hover:shadow-laser-green/60 hover:bg-laser-green/10',
    red: 'text-plasma-red shadow-plasma-red/30 hover:shadow-plasma-red/60 hover:bg-plasma-red/10',
};

export function NeonButton({
    children,
    variant = 'amber',
    className = '',
    ...props
}: NeonButtonProps) {
    return (
        <button
            className={`
        px-2 py-1
        rounded-lg
        border border-current
        bg-transparent
        font-medium
        uppercase
        tracking-wider
        transition-all
        duration-300
        shadow-lg
        ${variantStyles[variant]}
        ${className}
      `}
            {...props}
        >
            {children}
        </button>
    );
}
