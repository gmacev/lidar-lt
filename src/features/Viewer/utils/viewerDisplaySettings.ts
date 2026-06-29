import { z } from 'zod';
import type { PointCloud, Potree, PotreeViewer } from '@/common/types/potree';
import {
    configureMaterialForElevation,
    configureMaterialForIntensity,
    EDL_DEFAULTS,
    getDefaultPointBudget,
    PERFORMANCE_DEFAULTS,
    POINT_APPEARANCE_DEFAULTS,
    POINT_SIZE_DEFAULTS,
    RELIEF_DEFAULTS,
} from '@/features/Viewer/config';
import { updateElevationRangeForZScale } from '@/features/Viewer/config/potreeMaterialConfig';
import {
    ViewerStateSchema,
    Z_SCALE_DEFAULTS,
    type ViewerState,
} from '@/features/Viewer/config/viewerConfig';
import { getPointSizeModeEnumValue } from './pointSizeModeUtils';
import { getShapeEnumValue } from './pointShapeUtils';

const INTENSITY_DEFAULTS = {
    max: 10_000,
    gamma: 1,
    brightness: 0,
} as const;

export const CLASSIFICATION_DISPLAY_ORDER = [
    2, // Ground
    3, // Low Vegetation
    4, // Medium Vegetation
    5, // High Vegetation
    6, // Buildings
    0, // Unclassified UI master for 0 and 1
    7, // Noise
] as const;

const VIEWER_DISPLAY_SETTING_KEYS = [
    'colorMode',
    'intensityMax',
    'ig',
    'ib',
    'elevationMin',
    'elevationMax',
    'ep',
    'edlEnabled',
    'edlStrength',
    'edlRadius',
    'reliefEnabled',
    'reliefStrength',
    'reliefRadius',
    'reliefAzimuth',
    'ps',
    'psm',
    'pq',
    'mns',
    'psh',
    'zScale',
    'pb',
    'fov',
    'hiddenClasses',
    'mapLabels',
] as const satisfies readonly (keyof ViewerState)[];

const viewerDisplaySettingsPick = {
    colorMode: true,
    intensityMax: true,
    ig: true,
    ib: true,
    elevationMin: true,
    elevationMax: true,
    ep: true,
    edlEnabled: true,
    edlStrength: true,
    edlRadius: true,
    reliefEnabled: true,
    reliefStrength: true,
    reliefRadius: true,
    reliefAzimuth: true,
    ps: true,
    psm: true,
    pq: true,
    mns: true,
    psh: true,
    zScale: true,
    pb: true,
    fov: true,
    hiddenClasses: true,
    mapLabels: true,
} as const;

export const ViewerDisplaySettingsSchema = ViewerStateSchema.pick(viewerDisplaySettingsPick);
export type ViewerDisplaySettings = z.infer<typeof ViewerDisplaySettingsSchema>;
type ViewerDisplaySettingsKey = (typeof VIEWER_DISPLAY_SETTING_KEYS)[number];

export function pickViewerDisplaySettings(state: Partial<ViewerState>): ViewerDisplaySettings {
    return ViewerDisplaySettingsSchema.parse(state);
}

function omitViewerDisplaySettings(state: ViewerState): ViewerState {
    const nextState: ViewerState = { ...state };

    for (const key of VIEWER_DISPLAY_SETTING_KEYS) {
        delete nextState[key];
    }

    return nextState;
}

function getClearedViewerDisplaySettings(): Partial<ViewerState> {
    const clearedSettings: Partial<ViewerState> = {};
    const writableClearedSettings = clearedSettings as Record<ViewerDisplaySettingsKey, undefined>;

    for (const key of VIEWER_DISPLAY_SETTING_KEYS) {
        writableClearedSettings[key] = undefined;
    }

    return clearedSettings;
}

function mergeViewerDisplaySettings(
    baseState: ViewerState,
    settings: ViewerDisplaySettings
): ViewerState {
    return {
        ...baseState,
        ...pickViewerDisplaySettings(settings),
    };
}

export function replaceViewerDisplaySettings(
    baseState: ViewerState,
    settings: ViewerDisplaySettings
): ViewerState {
    return mergeViewerDisplaySettings(
        {
            ...omitViewerDisplaySettings(baseState),
            ...getClearedViewerDisplaySettings(),
        },
        settings
    );
}

function getElevationRange(settings: ViewerDisplaySettings): [number, number] | undefined {
    const { elevationMin, elevationMax } = settings;

    if (
        typeof elevationMin === 'number' &&
        typeof elevationMax === 'number' &&
        elevationMax > elevationMin
    ) {
        return [elevationMin, elevationMax];
    }

    return undefined;
}

function applyPointCloudColor(
    pointcloud: PointCloud,
    PotreeLib: Potree,
    settings: ViewerDisplaySettings
) {
    const colorMode = settings.colorMode ?? 'elevation';

    if (colorMode === 'intensity') {
        configureMaterialForIntensity(pointcloud, PotreeLib);
        pointcloud.material.intensityRange = [0, settings.intensityMax ?? INTENSITY_DEFAULTS.max];
        pointcloud.material.intensityGamma = settings.ig ?? INTENSITY_DEFAULTS.gamma;
        pointcloud.material.intensityBrightness = settings.ib ?? INTENSITY_DEFAULTS.brightness;
        pointcloud.material.needsUpdate = true;
        return;
    }

    configureMaterialForElevation(pointcloud, PotreeLib, {
        elevationRange: getElevationRange(settings),
        palette: settings.ep ?? POINT_APPEARANCE_DEFAULTS.elevationPalette,
    });
}

function applyPointCloudAppearance(
    pointcloud: PointCloud,
    PotreeLib: Potree,
    settings: ViewerDisplaySettings
) {
    pointcloud.material.size = settings.ps ?? POINT_SIZE_DEFAULTS.size;
    pointcloud.material.pointSizeType = getPointSizeModeEnumValue(
        settings.psm ?? POINT_APPEARANCE_DEFAULTS.sizeMode,
        PotreeLib
    );
    pointcloud.material.shape = getShapeEnumValue(
        settings.psh ?? POINT_APPEARANCE_DEFAULTS.shape,
        PotreeLib
    );
    pointcloud.material.needsUpdate = true;

    const zScale = settings.zScale ?? Z_SCALE_DEFAULTS.scale;
    const currentX = pointcloud.scale.x;
    pointcloud.scale.z = currentX * zScale;
    updateElevationRangeForZScale(pointcloud, zScale);
}

function showAllClassifications(viewer: PotreeViewer) {
    for (const pointcloud of viewer.scene.pointclouds) {
        const classificationMap = pointcloud.material.classification;
        if (!classificationMap) continue;

        Object.values(classificationMap).forEach((classification) => {
            classification.visible = true;
        });
        pointcloud.material.recomputeClassification();
    }
}

function applyClassificationVisibility(viewer: PotreeViewer, hiddenClasses?: number[]) {
    showAllClassifications(viewer);

    const hiddenClassSet = new Set(hiddenClasses ?? []);

    for (const id of CLASSIFICATION_DISPLAY_ORDER) {
        const isVisible = !hiddenClassSet.has(id);
        viewer.setClassificationVisibility(id, isVisible);

        if (id === 0) {
            viewer.setClassificationVisibility(1, isVisible && !hiddenClassSet.has(1));
        }
    }

    for (const hiddenClass of hiddenClassSet) {
        viewer.setClassificationVisibility(hiddenClass, false);
    }
}

export function applyViewerDisplaySettings(
    viewer: PotreeViewer | null,
    state: Partial<ViewerState>
): void {
    if (!viewer) return;

    const settings = pickViewerDisplaySettings(state);

    viewer.setFOV(settings.fov ?? PERFORMANCE_DEFAULTS.fov);
    viewer.setPointBudget(settings.pb ?? getDefaultPointBudget());
    viewer.setMinNodeSize(settings.mns ?? PERFORMANCE_DEFAULTS.minNodeSize);
    viewer.useHQ = (settings.pq ?? POINT_APPEARANCE_DEFAULTS.quality) === 'high';
    viewer.setEDLEnabled(settings.edlEnabled ?? EDL_DEFAULTS.enabled);
    viewer.setEDLStrength(settings.edlStrength ?? EDL_DEFAULTS.strength);
    viewer.setEDLRadius(settings.edlRadius ?? EDL_DEFAULTS.radius);
    viewer.setReliefEnabled(settings.reliefEnabled ?? RELIEF_DEFAULTS.enabled);
    viewer.setReliefStrength(settings.reliefStrength ?? RELIEF_DEFAULTS.strength);
    viewer.setReliefRadius(settings.reliefRadius ?? RELIEF_DEFAULTS.radius);
    viewer.setReliefAzimuth(settings.reliefAzimuth ?? RELIEF_DEFAULTS.azimuth);

    const PotreeLib: Potree | undefined = window.Potree;
    if (PotreeLib) {
        for (const pointcloud of viewer.scene.pointclouds) {
            applyPointCloudColor(pointcloud, PotreeLib, settings);
            applyPointCloudAppearance(pointcloud, PotreeLib, settings);
        }
    }

    applyClassificationVisibility(viewer, settings.hiddenClasses);
}
