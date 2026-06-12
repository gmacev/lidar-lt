import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { Vector3 } from 'three';
import type {
    PointCloud,
    PotreeViewer,
    Profile,
    ProfileRequest,
    ProfileRequestEvent,
} from '@/common/types/potree';
import { downloadCsv } from '@/common/utils/downloadCsv';

interface UseProfileDataOptions {
    viewerRef: RefObject<PotreeViewer | null>;
    profile: Profile | null;
}

export type ProfileDataStatus = 'idle' | 'waiting' | 'loading' | 'ready' | 'empty' | 'error';

export interface ProfileSegment {
    index: number;
    startDistance: number;
    endDistance: number;
    length: number;
}

export interface ProfileSample {
    mileage: Float64Array;
    elevation: Float32Array;
    displayElevation: Float32Array;
    x: Float64Array;
    y: Float64Array;
    classification: Uint8Array;
    segmentIndex: Uint16Array;
    count: number;
}

export interface ProfileBin {
    distance: number;
    segmentIndex: number;
    minElevation: number;
    maxElevation: number;
    groundElevation: number | null;
    minPoint: { x: number; y: number; z: number };
    maxPoint: { x: number; y: number; z: number };
}

export interface ProfileSummary {
    length: number;
    segmentCount: number;
    acceptedPointCount: number;
    sampledPointCount: number;
    minElevation: number | null;
    maxElevation: number | null;
}

interface UseProfileDataReturn {
    sample: ProfileSample;
    bins: ProfileBin[];
    segments: ProfileSegment[];
    status: ProfileDataStatus;
    summary: ProfileSummary;
    revision: number;
    exportToCsv: (cellId: string) => void;
}

const EMPTY_SAMPLE: ProfileSample = {
    mileage: new Float64Array(),
    elevation: new Float32Array(),
    displayElevation: new Float32Array(),
    x: new Float64Array(),
    y: new Float64Array(),
    classification: new Uint8Array(),
    segmentIndex: new Uint16Array(),
    count: 0,
};
const SAMPLE_LIMIT = 10_000;
const REQUEST_POINT_LIMIT = 20_000;
const PROFILE_MAX_DEPTH = 10;
const CSV_BIN_SIZE = 0.2;

interface MutablePoint {
    mileage: number;
    elevation: number;
    displayElevation: number;
    x: number;
    y: number;
    classification: number;
    segmentIndex: number;
}

interface MutableBin {
    binIndex: number;
    segmentIndex: number;
    min: number;
    max: number;
    groundSum: number;
    groundCount: number;
    minPoint: { x: number; y: number; z: number };
    maxPoint: { x: number; y: number; z: number };
}

function buildSegments(profile: Profile | null): ProfileSegment[] {
    if (!profile || profile.points.length < 2) return [];

    let distance = 0;
    return profile.points.slice(0, -1).map((start, index) => {
        const end = profile.points[index + 1];
        const length = Math.hypot(end.x - start.x, end.y - start.y);
        const segment = {
            index,
            startDistance: distance,
            endDistance: distance + length,
            length,
        };
        distance += length;
        return segment;
    });
}

function createRequestProfile(profile: Profile): Profile {
    const points: Vector3[] = [];
    for (const point of profile.points) {
        const previous = points.at(-1);
        if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) > 0.001) {
            points.push(point.clone());
        }
    }

    return {
        ...profile,
        points,
        width: profile.width,
    };
}

function toTypedSample(points: MutablePoint[]): ProfileSample {
    const count = points.length;
    const sample: ProfileSample = {
        mileage: new Float64Array(count),
        elevation: new Float32Array(count),
        displayElevation: new Float32Array(count),
        x: new Float64Array(count),
        y: new Float64Array(count),
        classification: new Uint8Array(count),
        segmentIndex: new Uint16Array(count),
        count,
    };

    for (let i = 0; i < count; i++) {
        const point = points[i];
        sample.mileage[i] = point.mileage;
        sample.elevation[i] = point.elevation;
        sample.displayElevation[i] = point.displayElevation;
        sample.x[i] = point.x;
        sample.y[i] = point.y;
        sample.classification[i] = point.classification;
        sample.segmentIndex[i] = point.segmentIndex;
    }
    return sample;
}

export function useProfileData({
    viewerRef,
    profile,
}: UseProfileDataOptions): UseProfileDataReturn {
    const [sample, setSample] = useState<ProfileSample>(EMPTY_SAMPLE);
    const [bins, setBins] = useState<ProfileBin[]>([]);
    const [status, setStatus] = useState<ProfileDataStatus>('idle');
    const [acceptedPointCount, setAcceptedPointCount] = useState(0);
    const [revision, setRevision] = useState(0);
    const [geometryRevision, setGeometryRevision] = useState(0);
    const requestsRef = useRef<ProfileRequest[]>([]);
    const publishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const generationRef = useRef(0);
    const profileUuidRef = useRef<string | null>(null);

    const cancelRequests = useCallback(() => {
        for (const request of requestsRef.current) request.cancel();
        requestsRef.current = [];
        if (publishTimerRef.current) {
            clearTimeout(publishTimerRef.current);
            publishTimerRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (!profile) return;

        const handleGeometryChange = () => {
            queueMicrotask(() => setGeometryRevision((value) => value + 1));
        };

        profile.addEventListener('marker_added', handleGeometryChange);
        profile.addEventListener('marker_removed', handleGeometryChange);
        profile.addEventListener('marker_dropped', handleGeometryChange);
        profile.addEventListener('width_changed', handleGeometryChange);

        return () => {
            profile.removeEventListener('marker_added', handleGeometryChange);
            profile.removeEventListener('marker_removed', handleGeometryChange);
            profile.removeEventListener('marker_dropped', handleGeometryChange);
            profile.removeEventListener('width_changed', handleGeometryChange);
        };
    }, [profile]);

    useEffect(() => {
        const viewer = viewerRef.current;
        generationRef.current++;
        const generation = generationRef.current;
        cancelRequests();
        const isNewProfile = profile?.uuid !== profileUuidRef.current;
        profileUuidRef.current = profile?.uuid ?? null;
        if (isNewProfile) {
            queueMicrotask(() => {
                if (generation !== generationRef.current) return;
                setSample(EMPTY_SAMPLE);
                setBins([]);
                setAcceptedPointCount(0);
            });
        }

        if (!viewer || !profile) {
            queueMicrotask(() => {
                if (generation === generationRef.current) setStatus('idle');
            });
            return;
        }
        const requestProfile = createRequestProfile(profile);
        if (requestProfile.points.length < 2) {
            queueMicrotask(() => {
                if (generation !== generationRef.current) return;
                setSample(EMPTY_SAMPLE);
                setBins([]);
                setAcceptedPointCount(0);
                setStatus('waiting');
            });
            return;
        }

        const mutablePoints: MutablePoint[] = [];
        const mutableBins = new Map<string, MutableBin>();
        let totalAccepted = 0;
        let finishedRequests = 0;
        let publishPending = false;

        const publish = () => {
            if (generation !== generationRef.current) return;
            publishPending = false;
            publishTimerRef.current = null;
            setSample(toTypedSample(mutablePoints));
            setBins(
                Array.from(mutableBins.values())
                    .sort((a, b) => a.binIndex - b.binIndex || a.segmentIndex - b.segmentIndex)
                    .map((bin) => ({
                        distance: bin.binIndex * CSV_BIN_SIZE,
                        segmentIndex: bin.segmentIndex,
                        minElevation: bin.min,
                        maxElevation: bin.max,
                        groundElevation:
                            bin.groundCount > 0 ? bin.groundSum / bin.groundCount : null,
                        minPoint: bin.minPoint,
                        maxPoint: bin.maxPoint,
                    }))
            );
            setAcceptedPointCount(totalAccepted);
            setRevision((value) => value + 1);
        };

        const schedulePublish = () => {
            if (publishPending) return;
            publishPending = true;
            publishTimerRef.current = setTimeout(publish, 500);
        };

        const visiblePointclouds = viewer.scene.pointclouds.filter(
            (pointcloud) => pointcloud.visible !== false
        );
        if (visiblePointclouds.length === 0) {
            setStatus('empty');
            return;
        }

        setStatus('loading');

        const processProgress = (pointcloud: PointCloud, event: ProfileRequestEvent) => {
            const positionZ = pointcloud.position.z;
            const verticalScale = pointcloud.scale.z / (pointcloud.scale.x || 1);
            const hasValidVerticalScale =
                Number.isFinite(verticalScale) && Math.abs(verticalScale) > Number.EPSILON;

            for (
                let segmentIndex = 0;
                segmentIndex < event.points.segments.length;
                segmentIndex++
            ) {
                const segment = event.points.segments[segmentIndex];
                const positions = segment.points.data.position;
                const mileages = segment.points.data.mileage;
                const classifications = segment.points.data.classification;

                for (let i = 0; i < segment.points.numPoints; i++) {
                    const localX = positions[i * 3];
                    const localY = positions[i * 3 + 1];
                    const displayElevation = positions[i * 3 + 2] + positionZ;
                    const elevation = hasValidVerticalScale
                        ? positionZ + (displayElevation - positionZ) / verticalScale
                        : displayElevation;
                    const x = localX + pointcloud.position.x;
                    const y = localY + pointcloud.position.y;
                    const mileage = mileages[i];
                    const classification = classifications?.[i] ?? 0;
                    totalAccepted++;

                    const point: MutablePoint = {
                        mileage,
                        elevation,
                        displayElevation,
                        x,
                        y,
                        classification,
                        segmentIndex,
                    };
                    if (mutablePoints.length < SAMPLE_LIMIT) {
                        mutablePoints.push(point);
                    } else {
                        const replacement = Math.floor(Math.random() * totalAccepted);
                        if (replacement < SAMPLE_LIMIT) mutablePoints[replacement] = point;
                    }

                    const binIndex = Math.floor(mileage / CSV_BIN_SIZE);
                    const binKey = `${segmentIndex}:${binIndex}`;
                    const existing = mutableBins.get(binKey);
                    const worldPoint = { x, y, z: elevation };
                    if (!existing) {
                        mutableBins.set(binKey, {
                            binIndex,
                            segmentIndex,
                            min: elevation,
                            max: elevation,
                            groundSum: classification === 2 ? elevation : 0,
                            groundCount: classification === 2 ? 1 : 0,
                            minPoint: worldPoint,
                            maxPoint: worldPoint,
                        });
                    } else {
                        if (elevation < existing.min) {
                            existing.min = elevation;
                            existing.minPoint = worldPoint;
                        }
                        if (elevation > existing.max) {
                            existing.max = elevation;
                            existing.maxPoint = worldPoint;
                        }
                        if (classification === 2) {
                            existing.groundSum += elevation;
                            existing.groundCount++;
                        }
                    }
                }
            }

            if (totalAccepted >= REQUEST_POINT_LIMIT) {
                for (const request of requestsRef.current) request.finishLevelThenCancel();
            }
            schedulePublish();
        };

        for (const pointcloud of visiblePointclouds) {
            const request = pointcloud.getPointsInProfile(requestProfile, PROFILE_MAX_DEPTH, {
                onProgress: (event) => processProgress(pointcloud, event),
                onFinish: () => {
                    finishedRequests++;
                    publish();
                    if (finishedRequests === visiblePointclouds.length) {
                        setStatus(totalAccepted > 0 ? 'ready' : 'empty');
                    }
                },
                onCancel: () => undefined,
            });
            requestsRef.current.push(request);
        }

        return () => {
            cancelRequests();
        };
    }, [cancelRequests, geometryRevision, profile, viewerRef]);

    const segments = buildSegments(profile);
    const summary: ProfileSummary = {
        length: segments.at(-1)?.endDistance ?? 0,
        segmentCount: segments.length,
        acceptedPointCount,
        sampledPointCount: sample.count,
        minElevation: bins.length > 0 ? Math.min(...bins.map((point) => point.minElevation)) : null,
        maxElevation: bins.length > 0 ? Math.max(...bins.map((point) => point.maxElevation)) : null,
    };

    const exportToCsv = (cellId: string) => {
        if (bins.length === 0) return;

        const header = 'Segment,Distance_m,Min_Z_m,Max_Z_m,Ground_Z_m,Min_X,Min_Y,Max_X,Max_Y\n';
        const rows = bins
            .map((point) =>
                [
                    point.segmentIndex + 1,
                    point.distance.toFixed(3),
                    point.minElevation.toFixed(3),
                    point.maxElevation.toFixed(3),
                    point.groundElevation?.toFixed(3) ?? '',
                    point.minPoint.x.toFixed(3),
                    point.minPoint.y.toFixed(3),
                    point.maxPoint.x.toFixed(3),
                    point.maxPoint.y.toFixed(3),
                ].join(',')
            )
            .join('\n');

        downloadCsv(
            header + rows,
            `profile_${cellId}_${new Date().toISOString().slice(0, 10)}.csv`
        );
    };

    return { sample, bins, segments, status, summary, revision, exportToCsv };
}
