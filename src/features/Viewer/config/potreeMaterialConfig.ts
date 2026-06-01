/**
 * Potree point cloud material configuration
 * Configures elevation-based Viridis gradient coloring
 */

import type { PointCloud, Potree, PotreeGeometry } from '@/common/types/potree';

interface PointCloudWithBaseRange extends PointCloud {
    _baseElevationRange?: [number, number];
}
import { POINT_SIZE_DEFAULTS } from './viewerConfig';
import { createViridisGradient } from '@/features/Viewer/config/viridisPalette.ts';

const HIGH_ELEVATION_TAIL_START_MIN = 0.75;
const HIGH_ELEVATION_TAIL_START_MAX = 0.94;
const NOISE_CLASSIFICATIONS = new Set([7, 18]);

interface ElevationDisplayRange {
    min: number;
    max: number;
    topTailStart: number;
}

/**
 * Configure point cloud material for elevation-based coloring with Viridis gradient
 */
export function configureMaterialForElevation(pointcloud: PointCloud, PotreeLib: Potree): void {
    const material = pointcloud.material;
    const THREE = window.THREE; // Use global THREE from Potree

    // 1. Initial Metadata Fallback
    // We apply this IMMEDIATELY so the user sees *something* reasonable while we wait for data.
    const pcoGeometry = pointcloud.pcoGeometry;
    const posAttr = pcoGeometry?.pointAttributes?.attributes?.find(
        (attr) => attr.name === 'position'
    );

    let minZ: number;
    let maxZ: number;

    if (posAttr?.range) {
        // range is [[minX, minY, minZ], [maxX, maxY, maxZ]]
        minZ = posAttr.range[0][2];
        maxZ = posAttr.range[1][2];
    } else {
        // Fallback to bounding box
        const box = pointcloud.boundingBox;
        minZ = box.min.z;
        maxZ = box.max.z;
    }

    // Apply safe defaults initially
    material.activeAttributeName = 'elevation';
    material.elevationRange = [minZ, maxZ];
    material.gradient = createViridisGradient(THREE);

    // Point appearance
    material.size = POINT_SIZE_DEFAULTS.size;
    material.pointSizeType = PotreeLib.PointSizeType.ADAPTIVE;
    material.shape = PotreeLib.PointShape.CIRCLE;
    material.needsUpdate = true;

    // 2. Async Data Refinement
    // Attempt to access actual point data to calculate a robust range (ignoring outliers)
    refineElevationRangeFromData(pointcloud);
}

/**
 * Polling mechanism to access geometry data once loaded.
 * Calculates robust min/max by filtering outliers using histogram analysis.
 */
function refineElevationRangeFromData(pointcloud: PointCloud) {
    const POLL_INTERVAL = 100; // ms
    const MAX_ATTEMPTS = 50; // 5 seconds max wait
    let attempts = 0;

    const intervalId = setInterval(() => {
        attempts++;

        // Safety check if pointcloud was destroyed or material changed
        if (
            !pointcloud ||
            !pointcloud.material ||
            pointcloud.material.activeAttributeName !== 'elevation'
        ) {
            clearInterval(intervalId);
            return;
        }

        // Check if root geometry is available
        // Note: Accessing internal Potree structures safely
        const geometryNode = pointcloud.root?.geometryNode;
        const geometry = geometryNode?.geometry;

        if (geometry) {
            clearInterval(intervalId);

            // Ensure world matrix is up to date for transformation
            pointcloud.updateMatrixWorld(true);

            // Extract World Z values, excluding classified noise points from color scaling.
            const positions = sampleElevationsWithTransform(geometry, pointcloud.matrixWorld);

            if (positions && positions.length > 0) {
                const displayRange = calculateRobustRange(positions);

                // Normalize range to Scale 1.0 to ensure consistent coloring regardless of current Z-scale
                // This ensures that when Z-scale increases, points move UP relative to the fixed color gradient
                // causing them to move toward the top color, consistent with slider behavior.
                const scaleZ = pointcloud.scale.z || 1;
                const posZ = pointcloud.position.z || 0;

                const baseMin = (displayRange.min - posZ) / scaleZ + posZ;
                const baseMax = (displayRange.max - posZ) / scaleZ + posZ;

                // Store base range (at scale 1.0) on the pointcloud for later Z-scale updates
                const pc = pointcloud as PointCloudWithBaseRange;
                pc._baseElevationRange = [baseMin, baseMax];

                // Apply range accounting for current Z-scale (handles page reload with zScale in URL)
                const currentZScale = pointcloud.scale.z / (pointcloud.scale.x || 1);
                const scaledMin = (baseMin - posZ) * currentZScale + posZ;
                const scaledMax = (baseMax - posZ) * currentZScale + posZ;

                const material = pointcloud.material;
                material.elevationRange = [scaledMin, scaledMax];
                material.gradient = createViridisGradient(window.THREE, displayRange.topTailStart);
                material.needsUpdate = true;
            }
        }

        if (attempts >= MAX_ATTEMPTS) {
            clearInterval(intervalId);
        }
    }, POLL_INTERVAL);
}

/**
 * Extracts Z positions from geometry and transforms them to World Space
 * Uses striding for performance on large buffers.
 */
function sampleElevationsWithTransform(
    geometry: PotreeGeometry,
    matrixWorld: import('three').Matrix4
): Float32Array | null {
    const attributes = geometry.attributes;
    if (!attributes || !attributes.position) return null;

    const array = attributes.position.array;
    const classifications = attributes.classification?.array;
    const count = attributes.position.count;
    const stride = attributes.position.itemSize || 3;

    // Sampling parameters
    const TARGET_SAMPLE_COUNT = 50000;
    const step = Math.max(1, Math.floor(count / TARGET_SAMPLE_COUNT));
    const sampleCount = Math.ceil(count / step);

    const zValues = new Float32Array(sampleCount);

    // Matrix elements for manual multiplication (faster than Vector3 allocation)
    // Column-major: z = x*m2 + y*m6 + z*m10 + m14
    const e = matrixWorld.elements;
    const m2 = e[2],
        m6 = e[6],
        m10 = e[10],
        m14 = e[14];

    let outIdx = 0;
    for (let i = 0; i < count; i += step) {
        if (classifications && NOISE_CLASSIFICATIONS.has(classifications[i])) {
            continue;
        }

        const x = array[i * stride];
        const y = array[i * stride + 1];
        const z = array[i * stride + 2];

        // Transform to World Z
        zValues[outIdx++] = x * m2 + y * m6 + z * m10 + m14;
    }

    return outIdx > 0 ? zValues.subarray(0, outIdx) : null;
}

/**
 * Data-Driven Robust Range Calculation
 * Uses a histogram approach to trim bottom 1% and reserve a small color tail above P99.
 */
function calculateRobustRange(values: Float32Array): ElevationDisplayRange {
    let min = Infinity;
    let max = -Infinity;

    // 1. Calculate raw min/max
    for (let i = 0; i < values.length; i++) {
        const v = values[i];
        if (v < min) min = v;
        if (v > max) max = v;
    }

    if (min === Infinity || max === -Infinity) {
        return { min: 0, max: 100, topTailStart: 1 };
    }

    const range = max - min;
    if (range < 0.1) return { min, max, topTailStart: 1 }; // Flat terrain

    // 2. Histogram Analysis
    const BINS = 256;
    const histogram = new Int32Array(BINS);
    const binSize = range / BINS;

    for (let i = 0; i < values.length; i++) {
        const v = values[i];
        let binIdx = Math.floor((v - min) / binSize);
        if (binIdx >= BINS) binIdx = BINS - 1;
        if (binIdx < 0) binIdx = 0;
        histogram[binIdx]++;
    }

    // 3. Find thresholds (P1 and P99)
    const totalPoints = values.length;
    // 1% trimming per side - increased slightly to be safer against noise
    const lowerThresholdCount = Math.floor(totalPoints * 0.01);
    const upperThresholdCount = Math.floor(totalPoints * 0.99);

    let currentCount = 0;
    let robustMinIndex = 0;
    let robustMaxIndex = BINS - 1;

    // Find lower bound
    for (let i = 0; i < BINS; i++) {
        currentCount += histogram[i];
        if (currentCount > lowerThresholdCount) {
            robustMinIndex = i;
            break;
        }
    }

    // Find upper bound
    currentCount = 0;
    for (let i = 0; i < BINS; i++) {
        currentCount += histogram[i];
        if (currentCount >= upperThresholdCount) {
            robustMaxIndex = i;
            break;
        }
    }

    const robustMin = min + robustMinIndex * binSize;
    const robustMax = min + robustMaxIndex * binSize;
    const robustRange = robustMax - robustMin;
    const fullRange = max - robustMin;

    if (robustRange < 0.1 || fullRange <= robustRange) {
        return { min: robustMin, max: robustMax, topTailStart: 1 };
    }

    const rawTailStart = robustRange / fullRange;
    const topTailStart = Math.max(
        HIGH_ELEVATION_TAIL_START_MIN,
        Math.min(HIGH_ELEVATION_TAIL_START_MAX, rawTailStart)
    );
    const displayMax = robustMin + robustRange / topTailStart;

    return { min: robustMin, max: displayMax, topTailStart };
}

/**
 * Configure point cloud material for intensity-based coloring
 * Let Potree handle the range and gradient natively
 */
export function configureMaterialForIntensity(pointcloud: PointCloud, PotreeLib: Potree): void {
    const material = pointcloud.material;

    // Simply switch to intensity attribute - let Potree handle range/gradient
    material.activeAttributeName = 'intensity';

    // Point appearance
    material.pointSizeType = PotreeLib.PointSizeType.ADAPTIVE;
    material.shape = PotreeLib.PointShape.CIRCLE;
    material.needsUpdate = true;
}

/**
 * Configure point cloud material for return number coloring
 * Shows vegetation penetration layers: 1st return (canopy) to last return (ground)
 * Let Potree handle the color gradient natively
 */
export function configureMaterialForReturnNumber(pointcloud: PointCloud, PotreeLib: Potree): void {
    const material = pointcloud.material;

    // Switch to return number attribute - let Potree handle gradient natively
    material.activeAttributeName = 'return number';

    // Point appearance
    material.pointSizeType = PotreeLib.PointSizeType.ADAPTIVE;
    material.shape = PotreeLib.PointShape.CIRCLE;
    material.needsUpdate = true;
}

export function updateElevationRangeForZScale(pointcloud: PointCloud, zScale: number): void {
    const pc = pointcloud as PointCloudWithBaseRange;
    const baseRange = pc._baseElevationRange;

    if (!baseRange) {
        return;
    }

    const [baseMin, baseMax] = baseRange;
    const posZ = pointcloud.position.z || 0;

    const scaledMin = (baseMin - posZ) * zScale + posZ;
    const scaledMax = (baseMax - posZ) * zScale + posZ;

    pointcloud.material.elevationRange = [scaledMin, scaledMax];
    pointcloud.material.needsUpdate = true;
}
