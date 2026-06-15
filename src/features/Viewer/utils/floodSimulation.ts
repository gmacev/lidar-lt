export const FLOOD_SAMPLE_LIMIT = 50_000;
const FLOOD_PLAYBACK_DURATION_SECONDS = 12;

export type FloodRangeSource = 'ground-sample' | 'metadata';
export type FloodPlaybackSpeed = 0.5 | 1 | 2;

export interface FloodElevationRange {
    min: number;
    max: number;
}

export function clampFloodLevel(level: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, level));
}

export function getRobustFloodRange(
    sortedElevations: readonly number[]
): FloodElevationRange | null {
    if (sortedElevations.length === 0) return null;

    const lowerIndex = Math.floor((sortedElevations.length - 1) * 0.01);
    const upperIndex = Math.ceil((sortedElevations.length - 1) * 0.99);
    const min = sortedElevations[lowerIndex];
    const max = sortedElevations[upperIndex];

    if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
    if (max - min < 0.01) {
        return { min, max: min + 0.01 };
    }

    return { min, max };
}

export function getEstimatedBelowPercent(
    sortedElevations: readonly number[],
    waterLevel: number
): number {
    if (sortedElevations.length === 0) return 0;

    let low = 0;
    let high = sortedElevations.length;

    while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (sortedElevations[middle] <= waterLevel) {
            low = middle + 1;
        } else {
            high = middle;
        }
    }

    return (low / sortedElevations.length) * 100;
}

export function getPlaybackLevel(
    elapsedSeconds: number,
    min: number,
    max: number,
    speed: FloodPlaybackSpeed
): number {
    if (max <= min) return min;

    const progress = clampFloodLevel(
        (elapsedSeconds * speed) / FLOOD_PLAYBACK_DURATION_SECONDS,
        0,
        1
    );
    return min + (max - min) * progress;
}

export function physicalToDisplayZ(physicalZ: number, originZ: number, zScale: number): number {
    return originZ + (physicalZ - originZ) * zScale;
}

export function displayToPhysicalZ(displayZ: number, originZ: number, zScale: number): number {
    if (zScale === 0) return displayZ;
    return originZ + (displayZ - originZ) / zScale;
}

export function getPointCloudZScale(scaleX: number, scaleZ: number): number {
    if (!Number.isFinite(scaleX) || scaleX === 0 || !Number.isFinite(scaleZ)) return 1;
    return scaleZ / scaleX;
}
