/**
 * Type definitions for Potree 2.0
 * Based on actual usage patterns in this project
 */

import { Box3, Vector3, Color, WebGLRenderer, Camera, Matrix4 } from 'three';

// ============================================================================
// Potree Enums
// ============================================================================

export enum PointSizeType {
    FIXED = 0,
    ATTENUATED = 1,
    ADAPTIVE = 2,
}

export enum PointShape {
    SQUARE = 0,
    CIRCLE = 1,
    PARABOLOID = 2,
}

export enum CameraMode {
    ORTHOGRAPHIC = 0,
    PERSPECTIVE = 1,
    VR = 2,
}

// ============================================================================
// Point Attributes
// ============================================================================

export interface PointAttribute {
    name: string;
    numElements: number;
    byteSize: number;
    type: { ordinal: number; name: string; size: number };
    description: string;
    range: [number[], number[]]; // [[minX, minY, minZ], [maxX, maxY, maxZ]]
    initialRange: [number[], number[]];
}

export interface PointAttributes {
    attributes: PointAttribute[];
    byteSize: number;
    size: number;
    vectors: unknown[];
}

// ============================================================================
// Point Cloud Geometry (Internal Structures)
// ============================================================================

export interface PointCloudOctreeGeometry {
    pointAttributes: PointAttributes;
    boundingBox: Box3;
    offset: Vector3;
    scale: Vector3;
    spacing: number;
}

/** Internal Potree geometry attribute structure */
export interface PotreeGeometryAttribute {
    array: Float32Array | Uint8Array | Uint16Array;
    count: number;
    itemSize?: number;
}

/** Internal Potree geometry attributes container */
export interface PotreeGeometryAttributes {
    position?: PotreeGeometryAttribute;
    [key: string]: PotreeGeometryAttribute | undefined;
}

/** Internal Potree geometry structure (accessed via geometryNode.geometry) */
export interface PotreeGeometry {
    attributes?: PotreeGeometryAttributes;
}

/** Internal Potree geometry node structure */
export interface PotreeGeometryNode {
    geometry?: PotreeGeometry;
    boundingBox?: Box3;
}

// ============================================================================
// Material
// ============================================================================

export type GradientStop = [number, Color];

export interface PointCloudMaterial {
    activeAttributeName: string;
    elevationRange: [number, number];
    intensityRange: [number, number];
    gradient: GradientStop[] | null;
    size: number;
    pointSizeType: PointSizeType;
    shape: PointShape;
    needsUpdate: boolean;
    // Attribute filtering support
    ranges: Map<string, [number, number]>;
    setRange(name: string, min: number, max: number): void;
    classification: Record<
        number,
        { visible: boolean; name: string; color: [number, number, number, number] }
    >;
    /** Updates the GPU classification texture after visibility changes */
    recomputeClassification(): void;
}

// ============================================================================
// Point Cloud
// ============================================================================

export interface PointCloud {
    pcoGeometry: PointCloudOctreeGeometry;
    boundingBox: Box3;
    material: PointCloudMaterial;
    position: Vector3;
    scale: Vector3; // Added for Vertical Exaggeration
    name: string;
    // Added for World Space transformation
    matrixWorld: Matrix4;
    updateMatrixWorld(force?: boolean): void;
    // Visible octree nodes (tiles) - each has its own bounding box
    visibleNodes?: Array<{
        boundingBox: Box3;
        name: string;
        geometryNode?: PotreeGeometryNode;
    }>;
    // Internal structure access
    root?: {
        geometryNode?: PotreeGeometryNode;
    };
    profileRequests: ProfileRequest[];
}

// ============================================================================
// Scene
// ============================================================================

export interface PotreeScene {
    addPointCloud(pointcloud: PointCloud): void;
    pointclouds: PointCloud[];
    getActiveCamera(): Camera;
    view: {
        position: Vector3;
        yaw: number;
        pitch: number;
        radius: number;
        lookAt(target: Vector3): void;
        getPivot(): Vector3;
    };
    // Measurements
    measurements: Measure[];
    removeMeasurement(measurement: Measure): void;
    removeAllMeasurements(): void;
    // Volumes
    volumes: BoxVolume[];
    addVolume(volume: BoxVolume): void;
    removeVolume(volume: BoxVolume): void;
    // Underlying Three.js scene for adding custom objects
    scene: import('three').Scene;
    profiles: Profile[];
}

// ============================================================================
// Controls
// ============================================================================

export interface PotreeControls {
    enabled: boolean;
    addEventListener(event: string, callback: () => void): void;
}

export interface OrbitControls extends PotreeControls {
    invertDrag: boolean;
}

export type EarthControls = PotreeControls;

// ============================================================================
// Viewer
// ============================================================================

export interface PotreeViewer {
    scene: PotreeScene;
    renderer: WebGLRenderer;
    orbitControls: OrbitControls;
    earthControls: EarthControls;
    useHighQuality: boolean;
    measuringTool: MeasuringTool;
    profileTool: ProfileTool;
    volumeTool: VolumeTool;

    // Setup methods
    setEDLEnabled(enabled: boolean): void;
    setEDLStrength(strength: number): void;
    setEDLRadius(radius: number): void;
    setFOV(fov: number): void;
    setPointBudget(budget: number): void;
    setBackground(type: string): void;
    loadSkybox(path: string): void;
    setDescription(desc: string): void;

    background: string | null;
    skybox: {
        camera: THREE.Camera;
        scene: THREE.Scene;
        parent: THREE.Object3D;
    } | null;

    setMinNodeSize(size: number): void;
    setControls(controls: PotreeControls): void;
    loadSettingsFromURL(): void;

    // View methods
    fitToScreen(): void;
    setTopView(): void;
    setFrontView(): void;
    setLeftView(): void;
    setRightView(): void;
    setCameraMode(mode: CameraMode): void;
    cameraMode: CameraMode;
}

// ============================================================================
// Measurement Types
// ============================================================================

export interface MeasureInsertionOptions {
    showDistances?: boolean;
    showArea?: boolean;
    showAngles?: boolean;
    showCoordinates?: boolean;
    showHeight?: boolean;
    showCircle?: boolean;
    showAzimuth?: boolean;
    showEdges?: boolean;
    closed?: boolean;
    maxMarkers?: number;
    name?: string;
}

export interface MeasureEdgeLabel {
    setText(text: string): void;
}

export interface Measure {
    uuid: string;
    name: string;
    points: { position: Vector3 }[];
    showDistances: boolean;
    showArea: boolean;
    showAngles: boolean;
    showCircle: boolean;
    closed: boolean;
    addMarker(position: Vector3): void;
    removeMarker(index: number): void;
    getArea(): number;
    update(): void;
    /** Edge labels shown on measurement lines (e.g., distance labels) */
    edgeLabels?: MeasureEdgeLabel[];
}

export interface MeasuringTool {
    measurements: Measure[];
    showLabels: boolean;
    startInsertion(options?: MeasureInsertionOptions): Measure;
}

export interface Profile {
    uuid: string;
    name: string;
    points: Vector3[];
    width: number;
    height: number;
    addMarker(point: Vector3): void;
    removeMarker(index: number): void;
}

export interface ProfileTool {
    profiles: Profile[];
    startInsertion(options?: { width?: number; name?: string }): Profile;
}

// ============================================================================
// Volume Types
// ============================================================================

export interface BoxVolume {
    uuid: string;
    name: string;
    position: Vector3;
    scale: Vector3;
    clip: boolean;
    visible: boolean;
    showVolumeLabel: boolean;
    getVolume(): number;
    update(): void;
}

export interface VolumeInsertionOptions {
    type?: unknown;
    clip?: boolean;
    name?: string;
}

export interface VolumeTool {
    startInsertion(options?: VolumeInsertionOptions): BoxVolume;
}

// ============================================================================
// Load Result
// ============================================================================

export interface LoadPointCloudResult {
    pointcloud: PointCloud;
}

export type LoadPointCloudCallback = (result: LoadPointCloudResult) => void;

// ============================================================================
// Potree Global
// ============================================================================

export interface Potree {
    Viewer: new (container: HTMLElement) => PotreeViewer;
    PointSizeType: typeof PointSizeType;
    PointShape: typeof PointShape;
    loadPointCloud(url: string, name: string, callback: LoadPointCloudCallback): void;
    ProfileRequest: typeof ProfileRequest;
    CameraMode: typeof CameraMode;
    Utils: {
        loadSkybox(path: string): {
            camera: THREE.Camera;
            scene: THREE.Scene;
            parent: THREE.Object3D;
        };
    };
}

// ============================================================================
// Global Augmentation
// ============================================================================

// Proj4 type for coordinate transformation
interface Proj4Static {
    (fromProjection: string, toProjection: string, coordinates: [number, number]): [number, number];
    defs(name: string, definition: string): void;
    defs(name: string): unknown;
}

declare global {
    interface Window {
        Potree: Potree;
        THREE: typeof import('three');
        proj4: Proj4Static;
    }
}

// ============================================================================
// Potree Metadata (from metadata.json)
// ============================================================================

/** Attribute definition from Potree metadata.json */
export interface PotreeMetadataAttribute {
    name: string;
    description: string;
    size: number;
    numElements: number;
    elementSize: number;
    type: string;
    min: number[];
    max: number[];
    scale: number[];
    offset: number[];
    histogram?: number[];
}

/** Bounding box structure from metadata.json */
export interface PotreeMetadataBoundingBox {
    min: [number, number, number];
    max: [number, number, number];
}

/** Hierarchy info from metadata.json */
export interface PotreeMetadataHierarchy {
    firstChunkSize: number;
    stepSize: number;
    depth: number;
}

/** Complete Potree metadata.json structure */
export interface PotreeMetadata {
    version: string;
    name: string;
    description: string;
    points: number;
    projection: string;
    hierarchy: PotreeMetadataHierarchy;
    offset: [number, number, number];
    scale: [number, number, number];
    spacing: number;
    boundingBox: PotreeMetadataBoundingBox;
    encoding: string;
    attributes: PotreeMetadataAttribute[];
}

// ============================================================================
// Profile Request Types
// ============================================================================

export interface ProfileDataSegment {
    start: { x: number; y: number; z: number };
    end: { x: number; y: number; z: number };
    length: number;
    points: {
        numPoints: number;
        data: {
            position: Float32Array; // [x, y, z, x, y, z...]
            color?: Uint8Array;
            intensity?: Float32Array;
            classification?: Uint8Array;
        };
    };
}

export interface ProfileRequestEvent {
    points: {
        segments: ProfileDataSegment[];
        boundingBox?: Box3;
        numPoints?: number;
    };
}

export interface ProfileRequestCallback {
    onProgress: (event: ProfileRequestEvent) => void;
    onFinish: () => void;
    onCancel?: () => void;
    cancel?: () => void; // Helper for internal cleanup
}

export class ProfileRequest {
    constructor(
        pointcloud: PointCloud,
        profile: Profile,
        maxDepth: number,
        callback: ProfileRequestCallback
    );
    cancel(): void;
    update(): void;
}

declare global {
    var Potree: import('./potree').Potree;
}
