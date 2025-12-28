import { useTranslation } from 'react-i18next';
import { GlassPanel } from './GlassPanel';

/**
 * Language switcher component with LT/EN toggle.
 * Styled as a compact glass panel to match the app aesthetic.
 */
export function LanguageSwitcher() {
    const { i18n } = useTranslation();
    const currentLang = i18n.language?.startsWith('lt') ? 'lt' : 'en';

    const toggleLanguage = async () => {
        const newLang = currentLang === 'lt' ? 'en' : 'lt';
        await i18n.changeLanguage(newLang);
    };

    return (
        <GlassPanel className="px-1 py-0.5">
            <button
                onClick={() => void toggleLanguage()}
                className="flex items-center gap-1 text-xs font-medium"
                title={currentLang === 'lt' ? 'Switch to English' : 'Perjungti į lietuvių'}
            >
                <span
                    className={`px-1.5 py-0.5 rounded transition-all ${
                        currentLang === 'lt'
                            ? 'bg-neon-cyan/20 text-neon-cyan'
                            : 'text-white/40 hover:text-white/60'
                    }`}
                >
                    LT
                </span>
                <span
                    className={`px-1.5 py-0.5 rounded transition-all ${
                        currentLang === 'en'
                            ? 'bg-neon-cyan/20 text-neon-cyan'
                            : 'text-white/40 hover:text-white/60'
                    }`}
                >
                    EN
                </span>
            </button>
        </GlassPanel>
    );
}
