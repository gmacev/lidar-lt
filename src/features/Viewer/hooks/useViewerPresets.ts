import { useSyncExternalStore } from 'react';
import {
    createViewerPreset,
    deleteViewerPreset,
    getViewerPresetSnapshot,
    renameViewerPreset,
    subscribeViewerPresets,
    updateViewerPreset,
    VIEWER_PRESET_LIMIT,
    VIEWER_PRESET_NAME_MAX_LENGTH,
} from '@/features/Viewer/utils/viewerPresetStorage';

export function useViewerPresets() {
    const presets = useSyncExternalStore(
        subscribeViewerPresets,
        getViewerPresetSnapshot,
        getViewerPresetSnapshot
    );

    return {
        presets,
        createPreset: createViewerPreset,
        renamePreset: renameViewerPreset,
        updatePreset: updateViewerPreset,
        deletePreset: deleteViewerPreset,
        presetLimit: VIEWER_PRESET_LIMIT,
        presetNameMaxLength: VIEWER_PRESET_NAME_MAX_LENGTH,
    };
}
