import { useTranslation } from 'react-i18next';
import { GlassPanel } from './GlassPanel';

interface LanguageSwitcherProps {
    themed?: boolean;
}

/**
 * Language switcher component with LT/EN toggle.
 * Styled as a compact glass panel to match the app aesthetic.
 */
export function LanguageSwitcher({ themed = false }: LanguageSwitcherProps) {
    const { i18n } = useTranslation();
    const currentLang = i18n.language?.startsWith('lt') ? 'lt' : 'en';
    const activeClassName = 'bg-theme-brand/12 text-theme-brand';
    const inactiveClassName = themed
        ? 'text-panel-subtle hover:text-panel-muted'
        : 'text-white/40 hover:text-white/60';

    const toggleLanguage = async () => {
        const newLang = currentLang === 'lt' ? 'en' : 'lt';
        await i18n.changeLanguage(newLang);
    };

    return (
        <GlassPanel variant={themed ? 'themed' : 'viewer'} className="px-1 py-0.5">
            <button
                onClick={() => void toggleLanguage()}
                className="flex items-center gap-1 text-xs font-medium"
                title={currentLang === 'lt' ? 'Switch to English' : 'Perjungti į lietuvių'}
            >
                <span
                    className={`px-1.5 py-0.5 rounded transition-all ${
                        currentLang === 'lt' ? activeClassName : inactiveClassName
                    }`}
                >
                    LT
                </span>
                <span
                    className={`px-1.5 py-0.5 rounded transition-all ${
                        currentLang === 'en' ? activeClassName : inactiveClassName
                    }`}
                >
                    EN
                </span>
            </button>
        </GlassPanel>
    );
}
