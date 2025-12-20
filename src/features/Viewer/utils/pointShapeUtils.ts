/**
 * Utility functions for point cloud shape configuration
 */

import type { Potree } from '@/types/potree';
import type { PointShape } from '@/features/Viewer/config';

/**
 * Maps our URL-friendly shape values to Potree enum values
 */
export function getShapeEnumValue(shape: PointShape, PotreeLib: Potree): number {
    const shapeMap: Record<PointShape, number> = {
        square: PotreeLib.PointShape.SQUARE,
        circle: PotreeLib.PointShape.CIRCLE,
        paraboloid: PotreeLib.PointShape.PARABOLOID,
    };
    return shapeMap[shape];
}
