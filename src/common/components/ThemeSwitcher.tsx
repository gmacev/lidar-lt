import { useTranslation } from 'react-i18next';
import { useTheme } from '@/common/theme';
import { GlassPanel } from './GlassPanel';
import { Icon } from './Icon';

interface ThemeSwitcherProps {
    viewer?: boolean;
}

export function ThemeSwitcher({ viewer = false }: ThemeSwitcherProps) {
    const { t } = useTranslation();
    const { resolvedTheme, setPreference } = useTheme();
    const isDark = resolvedTheme === 'dark';
    const label = isDark ? t('theme.switchToLight') : t('theme.switchToDark');

    return (
        <GlassPanel variant={viewer ? 'viewer' : 'themed'} className="px-1 py-0.5">
            <button
                type="button"
                aria-label={label}
                title={label}
                onClick={() => setPreference(isDark ? 'light' : 'dark')}
                className="flex h-5 w-7 items-center justify-center rounded text-panel-muted transition-colors hover:bg-panel-hover hover:text-theme-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-brand/60"
            >
                <Icon name={isDark ? 'sun' : 'moon'} size={14} />
            </button>
        </GlassPanel>
    );
}
