/**
 * Shared configuration for the Potree viewer
 * Single source of truth for default values
 */

export const EDL_DEFAULTS: { enabled: boolean; strength: number; radius: number } = {
    enabled: true,
    strength: 1.0,
    radius: 0.5,
};

export const PERFORMANCE_DEFAULTS = {
    pointBudget: 8_000_000,
    pointBudgetMobile: 4_000_000,
    minNodeSize: 15,
    useHighQuality: true,
    fov: 60,
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
    size: 0.5,
};

export const Z_SCALE_DEFAULTS: { scale: number } = {
    scale: 1.0,
};

import { z } from 'zod';

export const ColorModeSchema = z.enum(['elevation', 'intensity', 'return-number']);
export type ColorMode = z.infer<typeof ColorModeSchema>;

export const PointShapeSchema = z.enum(['square', 'circle', 'paraboloid']);
export type PointShape = z.infer<typeof PointShapeSchema>;

export const ProjectionSchema = z.enum(['PERSPECTIVE', 'ORTHOGRAPHIC']);
export type Projection = z.infer<typeof ProjectionSchema>;

export const POINT_APPEARANCE_DEFAULTS = {
    shape: 'circle' as PointShape,
} as const;

export const BackgroundSchema = z.enum(['skybox', 'gradient', 'black']);
export type Background = z.infer<typeof BackgroundSchema>;
export const SkyboxVariantSchema = z.enum(['1', '2']);
export type SkyboxVariant = z.infer<typeof SkyboxVariantSchema>;

export const ViewerStateSchema = z.object({
    // Camera position
    x: z.number().optional(),
    y: z.number().optional(),
    z: z.number().optional(),
    // Camera orientation (direct values, more stable than target position)
    yaw: z.number().optional(),
    pitch: z.number().optional(),
    radius: z.number().optional(),
    // Color mode
    colorMode: ColorModeSchema.optional(),
    intensityMax: z.number().optional(),
    // EDL settings
    edlEnabled: z.boolean().optional(),
    edlStrength: z.number().optional(),
    edlRadius: z.number().optional(),
    // Rendering settings (short names to avoid Potree URL conflicts)
    ps: z.number().optional(), // point size
    mns: z.number().optional(), // min node size
    psh: PointShapeSchema.optional(), // point shape
    zScale: z.number().optional(), // vertical exaggeration
    pb: z.number().optional(), // point budget
    fov: z.number().optional(), // field of view
    // Classifications (array of hidden class IDs)
    hiddenClasses: z.array(z.number()).optional(),
    // Sector metadata
    sectorName: z.string().optional(),
    // Camera Projection
    projection: ProjectionSchema.optional(),
    // Background
    bg: BackgroundSchema.optional(),
    sb: SkyboxVariantSchema.optional(),
});

export type ViewerState = z.infer<typeof ViewerStateSchema>;
