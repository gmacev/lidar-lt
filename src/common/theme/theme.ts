import type { ThemePreference } from './themeStorage';

export type ResolvedTheme = 'light' | 'dark';

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
    return preference;
}

export function applyTheme(theme: ResolvedTheme): void {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
}
