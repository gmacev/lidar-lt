import { describe, expect, it } from 'vitest';
import {
    clampFloodLevel,
    displayToPhysicalZ,
    getEstimatedBelowPercent,
    getPlaybackLevel,
    getPointCloudZScale,
    getRobustFloodRange,
    physicalToDisplayZ,
} from './floodSimulation';

describe('flood simulation helpers', () => {
    it('clamps water levels to the available elevation range', () => {
        expect(clampFloodLevel(4, 5, 10)).toBe(5);
        expect(clampFloodLevel(8, 5, 10)).toBe(8);
        expect(clampFloodLevel(12, 5, 10)).toBe(10);
    });

    it('uses P1 and P99 to reject elevation outliers', () => {
        const elevations = Array.from({ length: 1001 }, (_, index) => index);
        elevations[0] = -10_000;
        elevations[elevations.length - 1] = 10_000;
        elevations.sort((a, b) => a - b);

        expect(getRobustFloodRange(elevations)).toEqual({ min: 10, max: 990 });
    });

    it('returns null for an empty sample and expands a flat range', () => {
        expect(getRobustFloodRange([])).toBeNull();
        expect(getRobustFloodRange([12, 12, 12])).toEqual({ min: 12, max: 12.01 });
    });

    it('estimates sampled ground coverage with binary search', () => {
        const elevations = [1, 2, 3, 4, 5];
        expect(getEstimatedBelowPercent(elevations, 0)).toBe(0);
        expect(getEstimatedBelowPercent(elevations, 3)).toBe(60);
        expect(getEstimatedBelowPercent(elevations, 6)).toBe(100);
    });

    it('calculates playback levels and clamps at the endpoint', () => {
        expect(getPlaybackLevel(0, 10, 22, 1)).toBe(10);
        expect(getPlaybackLevel(6, 10, 22, 1)).toBe(16);
        expect(getPlaybackLevel(6, 10, 22, 2)).toBe(22);
        expect(getPlaybackLevel(100, 10, 22, 0.5)).toBe(22);
    });

    it('converts between physical and vertically exaggerated elevations', () => {
        expect(physicalToDisplayZ(15, 5, 3)).toBe(35);
        expect(displayToPhysicalZ(35, 5, 3)).toBe(15);
        expect(getPointCloudZScale(2, 6)).toBe(3);
        expect(getPointCloudZScale(0, 6)).toBe(1);
    });
});
