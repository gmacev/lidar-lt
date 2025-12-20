import { useState, type ReactNode } from 'react';
import { Icon } from '@/common/components';

interface SidebarSectionProps {
    /** Section title displayed in header */
    title: string;
    /** Optional icon element displayed before title */
    icon?: ReactNode;
    /** Whether section is expanded by default */
    defaultOpen?: boolean;
    /** Section content */
    children: ReactNode;
}

/**
 * Collapsible section component for ViewerSidebar.
 * Features smooth height transition and consistent styling.
 */
export function SidebarSection({ title, icon, defaultOpen = true, children }: SidebarSectionProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="border-b border-white/10 last:border-b-0">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex w-full items-center justify-between py-2.5 text-left transition-colors hover:bg-white/5"
            >
                <div className="flex items-center gap-2">
                    {icon && <span className="text-neon-amber">{icon}</span>}
                    <span className="text-sm font-medium text-neon-amber">{title}</span>
                </div>
                <Icon
                    name="chevronDown"
                    size={16}
                    className={`text-white/60 transition-transform duration-200 ${isOpen ? 'rotate-0' : '-rotate-90'}`}
                />
            </button>

            <div
                className={`overflow-hidden transition-all duration-200 ease-in-out ${
                    isOpen ? 'max-h-[500px] opacity-100 pb-2.5' : 'max-h-0 opacity-0'
                }`}
            >
                {children}
            </div>
        </div>
    );
}
