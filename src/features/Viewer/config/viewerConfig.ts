/**
 * Shared configuration for the Potree viewer
 * Single source of truth for default values
 */

export const EDL_DEFAULTS: { enabled: boolean; strength: number; radius: number } = {
    enabled: true,
    strength: 1.0,
    radius: 0.6,
};

export const RELIEF_DEFAULTS: {
    enabled: boolean;
    strength: number;
    radius: number;
    azimuth: number;
} = {
    enabled: false,
    strength: 1.0,
    radius: 1.0,
    azimuth: 315,
};

export const PERFORMANCE_DEFAULTS = {
    pointBudget: 8_000_000,
    pointBudgetMobile: 4_000_000,
    minNodeSize: 15,
    // true cuts fps in half with not much visible improvement
    highQualitySplats: false,
    fov: 60,
} as const;

export const POINT_BUDGET_LIMITS = {
    min: 500_000,
    max: 100_000_000,
    step: 500_000,
    warning: 10_000_000,
} as const;

import { isMobile } from '@/common/utils/screenSize';

/**
 * Returns the appropriate default point budget based on screen size.
 * Mobile devices (< 640px) get a lower budget for better performance.
 */
export function getDefaultPointBudget(): number {
    return isMobile() ? PERFORMANCE_DEFAULTS.pointBudgetMobile : PERFORMANCE_DEFAULTS.pointBudget;
}

export const POINT_SIZE_DEFAULTS: { size: number } = {
    size: 1.0,
};

export const PROFILE_WIDTH_DEFAULTS = {
    default: 10,
    min: 0.25,
    max: 50,
    step: 0.25,
} as const;

export const Z_SCALE_DEFAULTS: { scale: number } = {
    scale: 1.0,
};

import { z } from 'zod';

const optionalSearchNumber = z.preprocess((value) => {
    if (value === undefined || value === null || value === '') return undefined;

    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}, z.number().optional());

const optionalPointBudget = z.preprocess((value) => {
    if (value === undefined || value === null || value === '') return undefined;

    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) return undefined;

    return Math.min(POINT_BUDGET_LIMITS.max, Math.max(POINT_BUDGET_LIMITS.min, parsed));
}, z.number().optional());

const optionalSearchBoolean = z.preprocess((value) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
}, z.boolean().optional());

const optionalSearchNumberArray = z.preprocess((value) => {
    if (value === undefined || value === null || value === '') return undefined;

    const values: unknown[] = Array.isArray(value) ? value : [value];
    const parsedValues = values
        .flatMap((item): unknown[] => (typeof item === 'string' ? item.split(',') : [item]))
        .map((item) => (typeof item === 'number' ? item : Number(item)))
        .filter(Number.isFinite);

    return parsedValues.length > 0 ? parsedValues : undefined;
}, z.array(z.number()).optional());

const ColorModeSchema = z.preprocess(
    (value) => (value === 'return-number' ? 'elevation' : value),
    z.enum(['elevation', 'intensity'])
);
export type ColorMode = z.infer<typeof ColorModeSchema>;

const PointShapeSchema = z.enum(['square', 'circle', 'paraboloid']);
export type PointShape = z.infer<typeof PointShapeSchema>;

const PointSizeModeSchema = z.enum(['fixed', 'adaptive']);
export type PointSizeMode = z.infer<typeof PointSizeModeSchema>;

const PointQualitySchema = z.enum(['standard', 'high']);
export type PointQuality = z.infer<typeof PointQualitySchema>;

const ElevationPaletteSchema = z.enum(['custom', 'terrain', 'grayscale']);
export type ElevationPalette = z.infer<typeof ElevationPaletteSchema>;

const ProjectionSchema = z.enum(['PERSPECTIVE', 'ORTHOGRAPHIC']);
export type Projection = z.infer<typeof ProjectionSchema>;

export const POINT_APPEARANCE_DEFAULTS = {
    shape: 'circle' as PointShape,
    sizeMode: 'adaptive' as PointSizeMode,
    quality: 'standard' as PointQuality,
    elevationPalette: 'custom' as ElevationPalette,
} as const;

const BackgroundSchema = z.enum(['skybox', 'gradient', 'black']);
const SkyboxVariantSchema = z.enum(['1', '2']);

export const POTREE_BACKGROUND_GRADIENT = {
    center: '#1f3440',
    edge: '#05080c',
    noise: 0.012,
} as const;

export const ViewerStateSchema = z.object({
    // Camera position
    x: optionalSearchNumber,
    y: optionalSearchNumber,
    z: optionalSearchNumber,
    // Camera orientation (direct values, more stable than target position)
    yaw: optionalSearchNumber,
    pitch: optionalSearchNumber,
    radius: optionalSearchNumber,
    // Color mode
    colorMode: ColorModeSchema.optional(),
    intensityMax: optionalSearchNumber,
    ig: optionalSearchNumber, // intensity gamma
    ib: optionalSearchNumber, // intensity brightness
    elevationMin: optionalSearchNumber,
    elevationMax: optionalSearchNumber,
    ep: ElevationPaletteSchema.optional(), // elevation palette
    // EDL settings
    edlEnabled: optionalSearchBoolean,
    edlStrength: optionalSearchNumber,
    edlRadius: optionalSearchNumber,
    // Relief detail settings
    reliefEnabled: optionalSearchBoolean,
    reliefStrength: optionalSearchNumber,
    reliefRadius: optionalSearchNumber,
    reliefAzimuth: optionalSearchNumber,
    // Rendering settings (short names to avoid Potree URL conflicts)
    ps: optionalSearchNumber, // point size
    psm: PointSizeModeSchema.optional(), // point size mode
    pq: PointQualitySchema.optional(), // point quality
    mns: optionalSearchNumber, // min node size
    psh: PointShapeSchema.optional(), // point shape
    zScale: optionalSearchNumber, // vertical exaggeration
    pb: optionalPointBudget, // point budget
    fov: optionalSearchNumber, // field of view
    // Classifications (array of hidden class IDs)
    hiddenClasses: optionalSearchNumberArray,
    // Sector metadata
    sectorName: z.string().optional(),
    // Shareable point markers encoded as x,y,z;x,y,z
    mk: z.string().optional(),
    // Camera Projection
    projection: ProjectionSchema.optional(),
    // Background
    bg: BackgroundSchema.optional(),
    sb: SkyboxVariantSchema.optional(),
});

export type ViewerState = z.infer<typeof ViewerStateSchema>;
