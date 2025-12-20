import { type ReactNode } from 'react';

interface SwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    icon?: ReactNode;
    className?: string;
}

export function Switch({ checked, onChange, icon, className = '' }: SwitchProps) {
    return (
        <button
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className={`
                relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent 
                transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-laser-green focus-visible:ring-offset-2
                ${checked ? 'bg-laser-green' : 'bg-white/10'}
                ${className}
            `}
        >
            <span className="sr-only">Use setting</span>
            <span
                className={`
                    pointer-events-none inline-flex h-5 w-5 transform items-center justify-center rounded-full bg-white shadow ring-0 
                    transition duration-200 ease-in-out
                    ${checked ? 'translate-x-5' : 'translate-x-0'}
                `}
            >
                {icon && (
                    <span
                        className={`transition-colors duration-200 ${checked ? 'text-emerald-600' : 'text-gray-400'}`}
                    >
                        {icon}
                    </span>
                )}
            </span>
        </button>
    );
}
