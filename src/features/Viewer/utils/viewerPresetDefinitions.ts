import { pickViewerDisplaySettings, type ViewerDisplaySettings } from './viewerDisplaySettings';

export interface ApplicableViewerPreset {
    state: ViewerDisplaySettings;
}

export interface PredefinedViewerPreset extends ApplicableViewerPreset {
    id: string;
    nameKey: `presets.predefined.${string}.name`;
    descriptionKey: `presets.predefined.${string}.description`;
}

function definePredefinedViewerPreset(preset: PredefinedViewerPreset): PredefinedViewerPreset {
    return {
        ...preset,
        state: pickViewerDisplaySettings(preset.state),
    };
}

export const PREDEFINED_VIEWER_PRESETS: readonly PredefinedViewerPreset[] = [
    definePredefinedViewerPreset({
        id: 'terrain-enhancement',
        nameKey: 'presets.predefined.terrainEnhancement.name',
        descriptionKey: 'presets.predefined.terrainEnhancement.description',
        state: {
            colorMode: 'elevation',
            ep: 'terrain',
            edlEnabled: true,
            edlStrength: 10,
            edlRadius: 2,
            reliefEnabled: true,
            reliefStrength: 2.5,
            reliefRadius: 1,
            reliefAzimuth: 315,
            ps: 2.5,
            psm: 'adaptive',
            mns: 5,
            psh: 'circle',
            zScale: 1,
            pb: 8_000_000,
            fov: 60,
            hiddenClasses: [7, 5, 6, 4, 3, 0],
            mapLabels: false,
        },
    }),
];
