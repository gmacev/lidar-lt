import { createContext } from 'react';
import type { ResolvedTheme } from './theme';
import type { ThemePreference } from './themeStorage';

export interface ThemeContextValue {
    preference: ThemePreference;
    resolvedTheme: ResolvedTheme;
    setPreference: (preference: ThemePreference) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);
