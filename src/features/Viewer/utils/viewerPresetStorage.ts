import { z } from 'zod';
import { createStorage } from '@/common/utils/storage';
import {
    ViewerDisplaySettingsSchema,
    pickViewerDisplaySettings,
    type ViewerDisplaySettings,
} from './viewerDisplaySettings';

export const VIEWER_PRESET_LIMIT = 50;
export const VIEWER_PRESET_NAME_MAX_LENGTH = 60;
const VIEWER_PRESET_STORAGE_KEY = 'viewer-presets:v1';
const FULL_STORAGE_KEY = `lidar:${VIEWER_PRESET_STORAGE_KEY}`;

const ViewerPresetSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1).max(VIEWER_PRESET_NAME_MAX_LENGTH),
    state: ViewerDisplaySettingsSchema,
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
});

const ViewerPresetCollectionSchema = z.object({
    version: z.literal(1),
    presets: z.array(ViewerPresetSchema).max(VIEWER_PRESET_LIMIT),
});

export type ViewerPreset = z.infer<typeof ViewerPresetSchema>;
type ViewerPresetCollection = z.infer<typeof ViewerPresetCollectionSchema>;
export type ViewerPresetMutationError =
    | 'empty-name'
    | 'name-too-long'
    | 'duplicate-name'
    | 'limit-reached'
    | 'not-found';

export type ViewerPresetMutationResult =
    | { ok: true; preset: ViewerPreset }
    | { ok: false; reason: ViewerPresetMutationError };

export type ViewerPresetDeleteResult = { ok: true } | { ok: false; reason: 'not-found' };

const defaultCollection: ViewerPresetCollection = {
    version: 1,
    presets: [],
};

const viewerPresetStorage = createStorage({
    key: VIEWER_PRESET_STORAGE_KEY,
    schema: ViewerPresetCollectionSchema,
    defaultValue: defaultCollection,
});

let viewerPresetSnapshot = readPresetSnapshot();
const listeners = new Set<() => void>();

function sortPresets(presets: ViewerPreset[]): ViewerPreset[] {
    return [...presets].sort((first, second) => second.updatedAt.localeCompare(first.updatedAt));
}

function readPresetSnapshot(): ViewerPreset[] {
    return sortPresets(viewerPresetStorage.get().presets);
}

function emitPresetChange() {
    for (const listener of listeners) {
        listener();
    }
}

function writePresetSnapshot(presets: ViewerPreset[]) {
    viewerPresetSnapshot = sortPresets(presets);
    viewerPresetStorage.set({
        version: 1,
        presets: viewerPresetSnapshot,
    });
    emitPresetChange();
}

function normalizePresetName(name: string): string {
    return name.trim();
}

function hasDuplicateName(presets: ViewerPreset[], name: string, excludedId?: string): boolean {
    const normalizedName = name.toLocaleLowerCase();

    return presets.some(
        (preset) =>
            preset.id !== excludedId && preset.name.trim().toLocaleLowerCase() === normalizedName
    );
}

function validatePresetName(
    name: string,
    presets: ViewerPreset[],
    excludedId?: string
): { ok: true; name: string } | { ok: false; reason: ViewerPresetMutationError } {
    const normalizedName = normalizePresetName(name);

    if (normalizedName.length === 0) {
        return { ok: false, reason: 'empty-name' };
    }

    if (normalizedName.length > VIEWER_PRESET_NAME_MAX_LENGTH) {
        return { ok: false, reason: 'name-too-long' };
    }

    if (hasDuplicateName(presets, normalizedName, excludedId)) {
        return { ok: false, reason: 'duplicate-name' };
    }

    return { ok: true, name: normalizedName };
}

function createPresetId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    return `preset-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function subscribeViewerPresets(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function getViewerPresetSnapshot(): ViewerPreset[] {
    return viewerPresetSnapshot;
}

export function createViewerPreset(
    name: string,
    state: ViewerDisplaySettings
): ViewerPresetMutationResult {
    const presets = getViewerPresetSnapshot();
    const validatedName = validatePresetName(name, presets);

    if (!validatedName.ok) {
        return { ok: false, reason: validatedName.reason };
    }

    if (presets.length >= VIEWER_PRESET_LIMIT) {
        return { ok: false, reason: 'limit-reached' };
    }

    const now = new Date().toISOString();
    const preset: ViewerPreset = {
        id: createPresetId(),
        name: validatedName.name,
        state: pickViewerDisplaySettings(state),
        createdAt: now,
        updatedAt: now,
    };

    writePresetSnapshot([preset, ...presets]);
    return { ok: true, preset };
}

export function renameViewerPreset(id: string, name: string): ViewerPresetMutationResult {
    const presets = getViewerPresetSnapshot();
    const preset = presets.find((item) => item.id === id);

    if (!preset) {
        return { ok: false, reason: 'not-found' };
    }

    const validatedName = validatePresetName(name, presets, id);
    if (!validatedName.ok) {
        return { ok: false, reason: validatedName.reason };
    }

    const updatedPreset: ViewerPreset = {
        ...preset,
        name: validatedName.name,
        updatedAt: new Date().toISOString(),
    };

    writePresetSnapshot(presets.map((item) => (item.id === id ? updatedPreset : item)));
    return { ok: true, preset: updatedPreset };
}

export function updateViewerPreset(
    id: string,
    state: ViewerDisplaySettings
): ViewerPresetMutationResult {
    const presets = getViewerPresetSnapshot();
    const preset = presets.find((item) => item.id === id);

    if (!preset) {
        return { ok: false, reason: 'not-found' };
    }

    const updatedPreset: ViewerPreset = {
        ...preset,
        state: pickViewerDisplaySettings(state),
        updatedAt: new Date().toISOString(),
    };

    writePresetSnapshot(presets.map((item) => (item.id === id ? updatedPreset : item)));
    return { ok: true, preset: updatedPreset };
}

export function deleteViewerPreset(id: string): ViewerPresetDeleteResult {
    const presets = getViewerPresetSnapshot();
    const nextPresets = presets.filter((preset) => preset.id !== id);

    if (nextPresets.length === presets.length) {
        return { ok: false, reason: 'not-found' };
    }

    writePresetSnapshot(nextPresets);
    return { ok: true };
}

if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
        if (event.key !== FULL_STORAGE_KEY) return;

        viewerPresetSnapshot = readPresetSnapshot();
        emitPresetChange();
    });
}
