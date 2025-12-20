/**
 * Potree point cloud material configuration
 * Configures elevation-based Viridis gradient coloring
 */

import type { PointCloud, Potree, GradientStop, PotreeGeometry } from '@/types/potree';
import { POINT_SIZE_DEFAULTS } from './viewerConfig';

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

            // Extract World Z values
            const positions = sampleElevationsWithTransform(geometry, pointcloud.matrixWorld);

            if (positions && positions.length > 0) {
                const [robustMin, robustMax] = calculateRobustRange(positions);

                // Normalize range to Scale 1.0 to ensure consistent coloring regardless of current Z-scale
                // This ensures that when Z-scale increases, points move UP relative to the fixed color gradient
                // causing them to turn yellow (limit of the gradient), consistent with slider behavior.
                const scaleZ = pointcloud.scale.z || 1;
                const posZ = pointcloud.position.z || 0;

                const baseMin = (robustMin - posZ) / scaleZ + posZ;
                const baseMax = (robustMax - posZ) / scaleZ + posZ;

                // Apply normalized range
                const material = pointcloud.material;
                material.elevationRange = [baseMin, baseMax];
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
    const count = attributes.position.count;
    const stride = attributes.position.itemSize || 3;

    // Sampling parameters
    const TARGET_SAMPLE_COUNT = 50000;
    const step = Math.max(1, Math.floor(count / TARGET_SAMPLE_COUNT));
    const sampleCount = Math.floor(count / step);

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
        const x = array[i * stride];
        const y = array[i * stride + 1];
        const z = array[i * stride + 2];

        // Transform to World Z
        zValues[outIdx++] = x * m2 + y * m6 + z * m10 + m14;
    }

    return zValues;
}

/**
 * Data-Driven Robust Range Calculation
 * Uses a histogram approach to trim bottom 1% and top 1% of outliers.
 */
function calculateRobustRange(values: Float32Array): [number, number] {
    let min = Infinity;
    let max = -Infinity;

    // 1. Calculate raw min/max
    for (let i = 0; i < values.length; i++) {
        const v = values[i];
        if (v < min) min = v;
        if (v > max) max = v;
    }

    if (min === Infinity || max === -Infinity) return [0, 100];

    const range = max - min;
    if (range < 0.1) return [min, max]; // Flat terrain

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

    return [robustMin, robustMax];
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

// Viridis colormap - 256 colors for smooth gradients
// Each color is [R, G, B] normalized to 0-1
const VIRIDIS_LUT: [number, number, number][] = [
    [0.267, 0.004, 0.329],
    [0.269, 0.009, 0.335],
    [0.271, 0.014, 0.341],
    [0.272, 0.019, 0.347],
    [0.274, 0.024, 0.353],
    [0.275, 0.029, 0.359],
    [0.277, 0.034, 0.365],
    [0.278, 0.039, 0.37],
    [0.279, 0.044, 0.376],
    [0.28, 0.049, 0.381],
    [0.281, 0.054, 0.386],
    [0.282, 0.059, 0.391],
    [0.283, 0.064, 0.396],
    [0.284, 0.069, 0.401],
    [0.285, 0.074, 0.405],
    [0.285, 0.079, 0.41],
    [0.286, 0.084, 0.414],
    [0.286, 0.089, 0.418],
    [0.287, 0.094, 0.422],
    [0.287, 0.099, 0.426],
    [0.287, 0.104, 0.43],
    [0.287, 0.109, 0.434],
    [0.287, 0.114, 0.437],
    [0.287, 0.119, 0.441],
    [0.287, 0.124, 0.444],
    [0.287, 0.129, 0.447],
    [0.287, 0.134, 0.45],
    [0.286, 0.139, 0.453],
    [0.286, 0.144, 0.456],
    [0.285, 0.149, 0.459],
    [0.285, 0.154, 0.461],
    [0.284, 0.159, 0.464],
    [0.283, 0.164, 0.466],
    [0.282, 0.169, 0.468],
    [0.281, 0.174, 0.47],
    [0.28, 0.179, 0.472],
    [0.279, 0.184, 0.474],
    [0.278, 0.189, 0.476],
    [0.276, 0.194, 0.478],
    [0.275, 0.199, 0.479],
    [0.273, 0.204, 0.481],
    [0.272, 0.209, 0.482],
    [0.27, 0.214, 0.484],
    [0.268, 0.219, 0.485],
    [0.266, 0.224, 0.486],
    [0.264, 0.229, 0.487],
    [0.262, 0.234, 0.488],
    [0.26, 0.239, 0.489],
    [0.258, 0.244, 0.49],
    [0.256, 0.249, 0.491],
    [0.254, 0.254, 0.492],
    [0.251, 0.259, 0.492],
    [0.249, 0.264, 0.493],
    [0.247, 0.269, 0.493],
    [0.244, 0.274, 0.494],
    [0.242, 0.279, 0.494],
    [0.239, 0.284, 0.494],
    [0.237, 0.289, 0.495],
    [0.234, 0.294, 0.495],
    [0.231, 0.299, 0.495],
    [0.229, 0.304, 0.495],
    [0.226, 0.309, 0.495],
    [0.223, 0.314, 0.495],
    [0.22, 0.319, 0.495],
    [0.218, 0.324, 0.495],
    [0.215, 0.329, 0.495],
    [0.212, 0.334, 0.494],
    [0.209, 0.339, 0.494],
    [0.206, 0.344, 0.494],
    [0.203, 0.349, 0.493],
    [0.2, 0.354, 0.493],
    [0.197, 0.359, 0.492],
    [0.194, 0.364, 0.492],
    [0.191, 0.369, 0.491],
    [0.188, 0.374, 0.49],
    [0.185, 0.379, 0.489],
    [0.182, 0.384, 0.489],
    [0.179, 0.389, 0.488],
    [0.176, 0.394, 0.487],
    [0.173, 0.399, 0.486],
    [0.17, 0.404, 0.485],
    [0.167, 0.409, 0.484],
    [0.164, 0.414, 0.483],
    [0.161, 0.419, 0.481],
    [0.158, 0.424, 0.48],
    [0.156, 0.429, 0.479],
    [0.153, 0.434, 0.477],
    [0.15, 0.439, 0.476],
    [0.148, 0.444, 0.474],
    [0.145, 0.449, 0.473],
    [0.143, 0.454, 0.471],
    [0.141, 0.459, 0.469],
    [0.138, 0.464, 0.468],
    [0.136, 0.469, 0.466],
    [0.134, 0.474, 0.464],
    [0.132, 0.479, 0.462],
    [0.131, 0.484, 0.46],
    [0.129, 0.489, 0.458],
    [0.128, 0.494, 0.455],
    [0.127, 0.499, 0.453],
    [0.126, 0.504, 0.451],
    [0.125, 0.509, 0.448],
    [0.125, 0.514, 0.446],
    [0.124, 0.519, 0.443],
    [0.124, 0.524, 0.441],
    [0.124, 0.529, 0.438],
    [0.125, 0.534, 0.435],
    [0.125, 0.539, 0.432],
    [0.126, 0.544, 0.429],
    [0.127, 0.549, 0.426],
    [0.129, 0.553, 0.423],
    [0.13, 0.558, 0.42],
    [0.132, 0.563, 0.417],
    [0.134, 0.568, 0.413],
    [0.137, 0.573, 0.41],
    [0.139, 0.578, 0.406],
    [0.142, 0.582, 0.403],
    [0.145, 0.587, 0.399],
    [0.148, 0.592, 0.395],
    [0.152, 0.596, 0.391],
    [0.155, 0.601, 0.387],
    [0.159, 0.606, 0.383],
    [0.163, 0.61, 0.379],
    [0.168, 0.615, 0.375],
    [0.172, 0.619, 0.371],
    [0.177, 0.624, 0.366],
    [0.182, 0.628, 0.362],
    [0.187, 0.633, 0.357],
    [0.193, 0.637, 0.352],
    [0.198, 0.641, 0.347],
    [0.204, 0.646, 0.342],
    [0.21, 0.65, 0.337],
    [0.216, 0.654, 0.332],
    [0.223, 0.658, 0.327],
    [0.229, 0.662, 0.321],
    [0.236, 0.666, 0.316],
    [0.243, 0.67, 0.31],
    [0.25, 0.674, 0.304],
    [0.258, 0.678, 0.298],
    [0.265, 0.682, 0.292],
    [0.273, 0.686, 0.286],
    [0.281, 0.689, 0.279],
    [0.289, 0.693, 0.273],
    [0.297, 0.696, 0.266],
    [0.298, 0.7, 0.259],
    [0.314, 0.703, 0.252],
    [0.322, 0.707, 0.245],
    [0.331, 0.71, 0.238],
    [0.34, 0.713, 0.231],
    [0.349, 0.716, 0.223],
    [0.358, 0.719, 0.216],
    [0.368, 0.722, 0.208],
    [0.377, 0.725, 0.2],
    [0.387, 0.728, 0.192],
    [0.397, 0.731, 0.184],
    [0.407, 0.733, 0.175],
    [0.417, 0.736, 0.167],
    [0.427, 0.738, 0.158],
    [0.437, 0.741, 0.149],
    [0.448, 0.743, 0.14],
    [0.458, 0.745, 0.131],
    [0.469, 0.747, 0.122],
    [0.48, 0.749, 0.112],
    [0.491, 0.751, 0.103],
    [0.502, 0.753, 0.093],
    [0.513, 0.755, 0.083],
    [0.524, 0.756, 0.073],
    [0.536, 0.758, 0.063],
    [0.547, 0.759, 0.053],
    [0.559, 0.76, 0.043],
    [0.57, 0.762, 0.033],
    [0.582, 0.763, 0.024],
    [0.594, 0.764, 0.017],
    [0.606, 0.765, 0.014],
    [0.617, 0.765, 0.014],
    [0.629, 0.766, 0.016],
    [0.641, 0.767, 0.02],
    [0.653, 0.767, 0.025],
    [0.665, 0.767, 0.032],
    [0.677, 0.768, 0.04],
    [0.689, 0.768, 0.049],
    [0.701, 0.768, 0.059],
    [0.713, 0.767, 0.069],
    [0.725, 0.767, 0.081],
    [0.737, 0.767, 0.093],
    [0.749, 0.766, 0.106],
    [0.76, 0.765, 0.119],
    [0.772, 0.764, 0.133],
    [0.784, 0.763, 0.147],
    [0.795, 0.762, 0.162],
    [0.807, 0.761, 0.177],
    [0.818, 0.759, 0.192],
    [0.829, 0.757, 0.208],
    [0.84, 0.755, 0.224],
    [0.851, 0.753, 0.24],
    [0.862, 0.751, 0.257],
    [0.873, 0.749, 0.274],
    [0.883, 0.746, 0.291],
    [0.893, 0.743, 0.308],
    [0.903, 0.74, 0.326],
    [0.913, 0.737, 0.344],
    [0.923, 0.734, 0.362],
    [0.932, 0.73, 0.38],
    [0.941, 0.726, 0.398],
    [0.95, 0.722, 0.417],
    [0.959, 0.718, 0.435],
    [0.967, 0.714, 0.454],
    [0.975, 0.709, 0.473],
    [0.983, 0.704, 0.492],
    [0.99, 0.699, 0.511],
    [0.996, 0.694, 0.53],
    [0.993, 0.698, 0.538],
];

/**
 * Creates Viridis color gradient: Purple (low) -> Blue -> Green -> Yellow (high)
 */
function createViridisGradient(THREE: typeof import('three')): GradientStop[] {
    return VIRIDIS_LUT.map((rgb, index) => {
        // Potree wants [position, color]
        // Normalize index to 0-1
        const position = index / (VIRIDIS_LUT.length - 1);
        return [position, new THREE.Color(rgb[0], rgb[1], rgb[2])];
    });
}
