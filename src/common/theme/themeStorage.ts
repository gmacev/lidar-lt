import { z } from 'zod';
import { createStorage } from '@/common/utils/storage';

export const THEME_STORAGE_KEY = 'lidar:theme';
const DEFAULT_THEME_PREFERENCE = 'dark' as const;

const themePreferenceSchema = z.enum(['light', 'dark']);

export type ThemePreference = z.infer<typeof themePreferenceSchema>;

export const themePreferenceStorage = createStorage({
    key: 'theme',
    schema: themePreferenceSchema,
    defaultValue: DEFAULT_THEME_PREFERENCE,
});
