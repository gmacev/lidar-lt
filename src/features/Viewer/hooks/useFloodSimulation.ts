import { useEffect, useState, useRef, type RefObject } from 'react';
import {
    BoxGeometry,
    MeshBasicMaterial,
    Mesh,
    DoubleSide,
    Box3,
    Vector3,
    CanvasTexture,
    RepeatWrapping,
} from 'three';
import type { PotreeViewer, PotreeMetadata } from '@/types/potree';

interface UseFloodSimulationOptions {
    viewerRef: RefObject<PotreeViewer | null>;
    metadataUrl?: string; // URL to metadata.json for accurate bounds
}

interface UseFloodSimulationReturn {
    isActive: boolean;
    waterLevel: number;
    minElevation: number;
    maxElevation: number;
    precision: number;
    start: () => void;
    setWaterLevel: (level: number) => void;
    setPrecision: (step: number) => void;
    reset: () => void;
}

// Shared water texture
let sharedTexture: CanvasTexture | null = null;

// Hash function for pseudo-random gradients
function hash(x: number, y: number): number {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
}

// Smooth interpolation
function smoothstep(t: number): number {
    return t * t * (3 - 2 * t);
}

// Value noise that tiles at period
function tiledNoise(x: number, y: number, period: number): number {
    // Wrap coordinates to period
    const xi = Math.floor(x) % period;
    const yi = Math.floor(y) % period;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    // Wrap for next cell
    const xi1 = (xi + 1) % period;
    const yi1 = (yi + 1) % period;

    // Get corner values
    const v00 = hash(xi, yi);
    const v10 = hash(xi1, yi);
    const v01 = hash(xi, yi1);
    const v11 = hash(xi1, yi1);

    // Smooth interpolation
    const sx = smoothstep(xf);
    const sy = smoothstep(yf);

    // Bilinear interpolation
    const v0 = v00 + sx * (v10 - v00);
    const v1 = v01 + sx * (v11 - v01);
    return v0 + sy * (v1 - v0);
}

// Fractal Brownian Motion for natural water look
function waterFBM(x: number, y: number, size: number): number {
    let value = 0;
    const amplitude = 1;
    let totalAmplitude = 0;

    // Multiple octaves with different periods (all power of 2 for seamless tiling)
    const octaves = [
        { freq: 4, weight: 1.0 }, // Large swells
        { freq: 8, weight: 0.5 }, // Medium waves
        { freq: 16, weight: 0.25 }, // Small ripples
        { freq: 32, weight: 0.125 }, // Fine detail
    ];

    for (const octave of octaves) {
        const nx = (x / size) * octave.freq;
        const ny = (y / size) * octave.freq;
        value += tiledNoise(nx, ny, octave.freq) * octave.weight * amplitude;
        totalAmplitude += octave.weight * amplitude;
    }

    return value / totalAmplitude;
}

function createWaterTexture(): CanvasTexture {
    if (sharedTexture) return sharedTexture;

    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (ctx) {
        const imageData = ctx.createImageData(size, size);
        const data = imageData.data;

        // Water blue base
        const baseR = 20,
            baseG = 80,
            baseB = 140;
        // Lighter caustic highlights
        const highlightR = 55,
            highlightG = 130,
            highlightB = 195;

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                // Get noise value (0 to 1)
                const noise = waterFBM(x, y, size);

                // Create caustic-like effect with non-linear mapping
                const caustic = Math.pow(noise, 0.8);

                // Interpolate between base and highlight colors
                const r = baseR + (highlightR - baseR) * caustic;
                const g = baseG + (highlightG - baseG) * caustic;
                const b = baseB + (highlightB - baseB) * caustic;

                data[(y * size + x) * 4] = Math.round(r);
                data[(y * size + x) * 4 + 1] = Math.round(g);
                data[(y * size + x) * 4 + 2] = Math.round(b);
                data[(y * size + x) * 4 + 3] = 255;
            }
        }

        ctx.putImageData(imageData, 0, 0);
    }

    sharedTexture = new CanvasTexture(canvas);
    sharedTexture.wrapS = RepeatWrapping;
    sharedTexture.wrapT = RepeatWrapping;
    return sharedTexture;
}

interface MetadataPosition {
    min: [number, number, number];
    max: [number, number, number];
}

/**
 * Flood simulation hook that fetches metadata.json to get ACTUAL point extent.
 * Uses position attribute min/max for accurate bounds instead of bounding box.
 */
export function useFloodSimulation({
    viewerRef,
    metadataUrl,
}: UseFloodSimulationOptions): UseFloodSimulationReturn {
    const [isActive, setIsActive] = useState(false);
    const [waterLevel, setWaterLevelState] = useState(0);
    const [minElevation, setMinElevation] = useState(0);
    const [maxElevation, setMaxElevation] = useState(100);
    const [precision, setPrecisionState] = useState(1);

    const waterMeshRef = useRef<Mesh | null>(null);
    const boundsRef = useRef<Box3 | null>(null);
    const globalMinZRef = useRef<number>(0);

    // Define removeWaterMesh before useEffect to avoid accessing before declaration
    const removeWaterMesh = () => {
        const viewer = viewerRef.current;
        if (!viewer || !waterMeshRef.current) return;

        const threeScene = viewer.scene.scene;
        if (threeScene) {
            threeScene.remove(waterMeshRef.current);
        }

        waterMeshRef.current.geometry.dispose();
        if (waterMeshRef.current.material instanceof MeshBasicMaterial) {
            const mat = waterMeshRef.current.material;
            if (mat.map) mat.map.dispose();
            mat.dispose();
        }
        waterMeshRef.current = null;
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            removeWaterMesh();
        };
    }, []);

    const createWaterVolume = (bounds: Box3, waterHeight: number, globalMinZ: number) => {
        const viewer = viewerRef.current;
        if (!viewer) return;

        removeWaterMesh();

        const width = bounds.max.x - bounds.min.x;
        const depth = bounds.max.y - bounds.min.y;

        // Extend 500m below ground level
        const bottomExtension = 500;
        const effectiveBottom = globalMinZ - bottomExtension;
        const height = waterHeight - effectiveBottom;

        if (height <= 0) return;

        const geometry = new BoxGeometry(width, depth, height);

        const texture = createWaterTexture();
        // Larger divisor = bigger texture tiles = less visible repetition
        const textureScale = Math.max(width, depth) / 500;
        texture.repeat.set(textureScale, textureScale);

        const material = new MeshBasicMaterial({
            map: texture,
            transparent: false,
            side: DoubleSide,
            depthWrite: true,
        });

        const mesh = new Mesh(geometry, material);
        mesh.position.set(
            (bounds.min.x + bounds.max.x) / 2,
            (bounds.min.y + bounds.max.y) / 2,
            effectiveBottom + height / 2
        );
        mesh.name = 'flood-water-volume';

        const threeScene = viewer.scene.scene;
        if (threeScene) {
            threeScene.add(mesh);
            waterMeshRef.current = mesh;
        }
    };

    // Fetch metadata.json to get actual point extent
    const fetchActualBounds = async (): Promise<Box3 | null> => {
        if (!metadataUrl) return null;

        try {
            const response = await fetch(metadataUrl);
            if (!response.ok) return null;

            const metadata = (await response.json()) as PotreeMetadata;

            // Find the position attribute which has actual min/max
            const positionAttr = metadata.attributes?.find(
                (attr: { name: string }) => attr.name === 'position'
            ) as MetadataPosition | undefined;

            if (positionAttr?.min && positionAttr?.max) {
                return new Box3(
                    new Vector3(positionAttr.min[0], positionAttr.min[1], positionAttr.min[2]),
                    new Vector3(positionAttr.max[0], positionAttr.max[1], positionAttr.max[2])
                );
            }

            // Fallback to bounding box if no position attribute
            if (metadata.boundingBox) {
                return new Box3(
                    new Vector3(
                        metadata.boundingBox.min[0],
                        metadata.boundingBox.min[1],
                        metadata.boundingBox.min[2]
                    ),
                    new Vector3(
                        metadata.boundingBox.max[0],
                        metadata.boundingBox.max[1],
                        metadata.boundingBox.max[2]
                    )
                );
            }
        } catch (error) {
            console.warn('Failed to fetch metadata:', error);
        }

        return null;
    };

    // Get bounds from Potree viewer (fallback)
    const getViewerBounds = (): Box3 | null => {
        const viewer = viewerRef.current;
        if (!viewer?.scene?.pointclouds?.length) return null;

        const combinedBounds = new Box3();
        for (const pointcloud of viewer.scene.pointclouds) {
            const worldBounds = pointcloud.boundingBox.clone().applyMatrix4(pointcloud.matrixWorld);
            combinedBounds.union(worldBounds);
        }

        return combinedBounds;
    };

    const startAsync = async () => {
        // Try to get accurate bounds from metadata first
        let bounds = await fetchActualBounds();

        // Fallback to viewer bounds
        if (!bounds) {
            bounds = getViewerBounds();
        }

        if (!bounds) {
            console.warn('No bounds available for flood simulation');
            return;
        }

        boundsRef.current = bounds;
        globalMinZRef.current = bounds.min.z;

        setMinElevation(bounds.min.z);
        setMaxElevation(bounds.max.z);
        setWaterLevelState(bounds.min.z);
        setIsActive(true);
    };

    // Sync wrapper to match return type and avoid promise-returning function issues
    const start = () => {
        void startAsync();
    };

    const setWaterLevel = (level: number) => {
        const clampedLevel = Math.max(minElevation, Math.min(maxElevation, level));
        setWaterLevelState(clampedLevel);

        if (boundsRef.current) {
            createWaterVolume(boundsRef.current, clampedLevel, globalMinZRef.current);
        }
    };

    const setPrecision = (step: number) => {
        const clampedStep = Math.max(0.01, Math.min(100, step));
        setPrecisionState(clampedStep);
    };

    const reset = () => {
        removeWaterMesh();
        boundsRef.current = null;
        globalMinZRef.current = 0;
        setWaterLevelState(0);
        setMinElevation(0);
        setMaxElevation(100);
        setIsActive(false);
    };

    return {
        isActive,
        waterLevel,
        minElevation,
        maxElevation,
        precision,
        start,
        setWaterLevel,
        setPrecision,
        reset,
    };
}
