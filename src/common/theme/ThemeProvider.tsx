import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { ThemeContext, type ThemeContextValue } from './ThemeContext';
import { applyTheme, resolveTheme } from './theme';
import { THEME_STORAGE_KEY, themePreferenceStorage, type ThemePreference } from './themeStorage';

interface ThemeProviderProps {
    children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
    const [preference, setPreferenceState] = useState<ThemePreference>(() =>
        themePreferenceStorage.get()
    );
    const resolvedTheme = resolveTheme(preference);

    useLayoutEffect(() => {
        applyTheme(resolvedTheme);
    }, [resolvedTheme]);

    useEffect(() => {
        const handleStorage = (event: StorageEvent) => {
            if (event.key === THEME_STORAGE_KEY) {
                setPreferenceState(themePreferenceStorage.get());
            }
        };

        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    const setPreference = (nextPreference: ThemePreference) => {
        themePreferenceStorage.set(nextPreference);
        setPreferenceState(nextPreference);
    };

    const contextValue: ThemeContextValue = {
        preference,
        resolvedTheme,
        setPreference,
    };

    return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
}
