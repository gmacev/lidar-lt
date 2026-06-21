import { type RefObject, useEffect, useRef, useState } from 'react';
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
    packedPosition: Float32Array;
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

const SAMPLE_LIMIT = 60_000;
const REQUEST_POINT_LIMIT = 60_000;
const MAX_RETAINED_POINTS = 100_000;
const MAX_SAMPLE_BUCKETS = 512;
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

function createEmptySample(): ProfileSample {
    return {
        mileage: new Float64Array(),
        elevation: new Float32Array(),
        packedPosition: new Float32Array(),
        displayElevation: new Float32Array(),
        x: new Float64Array(),
        y: new Float64Array(),
        classification: new Uint8Array(),
        segmentIndex: new Uint16Array(),
        count: 0,
    };
}

function replaceSample(target: ProfileSample, source: ProfileSample) {
    target.mileage = source.mileage;
    target.elevation = source.elevation;
    target.packedPosition = source.packedPosition;
    target.displayElevation = source.displayElevation;
    target.x = source.x;
    target.y = source.y;
    target.classification = source.classification;
    target.segmentIndex = source.segmentIndex;
    target.count = source.count;
}

function replaceBins(target: ProfileBin[], source: ProfileBin[]) {
    target.length = source.length;
    for (let i = 0; i < source.length; i++) target[i] = source[i];
}

function createSummary(
    segments: ProfileSegment[],
    acceptedPointCount: number,
    sampledPointCount: number,
    minElevation: number | null,
    maxElevation: number | null
): ProfileSummary {
    return {
        length: segments.at(-1)?.endDistance ?? 0,
        segmentCount: segments.length,
        acceptedPointCount,
        sampledPointCount,
        minElevation,
        maxElevation,
    };
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
        packedPosition: new Float32Array(count * 2),
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
        sample.packedPosition[i * 2] = point.mileage;
        sample.packedPosition[i * 2 + 1] = point.elevation;
        sample.displayElevation[i] = point.displayElevation;
        sample.x[i] = point.x;
        sample.y[i] = point.y;
        sample.classification[i] = point.classification;
        sample.segmentIndex[i] = point.segmentIndex;
    }
    return sample;
}

function createDistanceAwareSample(points: MutablePoint[], profileLength: number) {
    if (points.length <= SAMPLE_LIMIT) return points;

    const bucketCount = Math.min(MAX_SAMPLE_BUCKETS, Math.max(64, Math.ceil(profileLength)));
    const buckets = Array.from({ length: bucketCount }, () => [] as MutablePoint[]);
    for (const point of points) {
        const normalizedDistance = point.mileage / Math.max(profileLength, Number.EPSILON);
        const bucketIndex = Math.min(
            bucketCount - 1,
            Math.max(0, Math.floor(normalizedDistance * bucketCount))
        );
        buckets[bucketIndex].push(point);
    }

    const populated = buckets
        .filter((bucket) => bucket.length > 0)
        .map((bucket) => ({ bucket, quota: 0 }));
    let remaining = SAMPLE_LIMIT;
    let expandable = populated;
    while (remaining > 0 && expandable.length > 0) {
        const share = Math.max(1, Math.floor(remaining / expandable.length));
        const nextExpandable: typeof populated = [];
        for (const entry of expandable) {
            if (remaining === 0) break;
            const added = Math.min(entry.bucket.length - entry.quota, share, remaining);
            entry.quota += added;
            remaining -= added;
            if (entry.quota < entry.bucket.length) nextExpandable.push(entry);
        }
        expandable = nextExpandable;
    }

    const sampled: MutablePoint[] = [];
    for (const { bucket, quota } of populated) {
        if (quota >= bucket.length) {
            for (const point of bucket) sampled.push(point);
            continue;
        }
        for (let i = 0; i < quota; i++) {
            sampled.push(bucket[Math.floor(((i + 0.5) * bucket.length) / quota)]);
        }
    }
    return sampled;
}

export function useProfileData({
    viewerRef,
    profile,
}: UseProfileDataOptions): UseProfileDataReturn {
    const sampleRef = useRef<ProfileSample>(createEmptySample());
    const binsRef = useRef<ProfileBin[]>([]);
    const segmentsRef = useRef<ProfileSegment[]>([]);
    const summaryRef = useRef<ProfileSummary>(createSummary([], 0, 0, null, null));
    const [status, setStatus] = useState<ProfileDataStatus>('idle');
    const [revision, setRevision] = useState(0);
    const [geometryRevision, setGeometryRevision] = useState(0);
    const requestsRef = useRef<ProfileRequest[]>([]);
    const publishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const generationRef = useRef(0);
    const profileUuidRef = useRef<string | null>(null);

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
        const cancelRequests = () => {
            for (const request of requestsRef.current) request.cancel();
            requestsRef.current = [];
            if (publishTimerRef.current) {
                clearTimeout(publishTimerRef.current);
                publishTimerRef.current = null;
            }
        };

        const viewer = viewerRef.current;
        generationRef.current++;
        const generation = generationRef.current;
        cancelRequests();
        const isNewProfile = profile?.uuid !== profileUuidRef.current;
        profileUuidRef.current = profile?.uuid ?? null;
        if (isNewProfile) {
            queueMicrotask(() => {
                if (generation !== generationRef.current) return;
                replaceSample(sampleRef.current, createEmptySample());
                binsRef.current.length = 0;
                segmentsRef.current = [];
                summaryRef.current = createSummary([], 0, 0, null, null);
                setRevision((value) => value + 1);
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
                replaceSample(sampleRef.current, createEmptySample());
                binsRef.current.length = 0;
                segmentsRef.current = [];
                summaryRef.current = createSummary([], 0, 0, null, null);
                setStatus('waiting');
                setRevision((value) => value + 1);
            });
            return;
        }

        const requestSegments = buildSegments(requestProfile);
        const profileLength = requestSegments.at(-1)?.endDistance ?? 0;
        segmentsRef.current = requestSegments;
        summaryRef.current = createSummary(requestSegments, 0, 0, null, null);
        queueMicrotask(() => {
            if (generation === generationRef.current) setRevision((value) => value + 1);
        });
        const mutablePoints: MutablePoint[] = [];
        const mutableBins = new Map<string, MutableBin>();
        let totalAccepted = 0;
        let finishedRequests = 0;
        let publishPending = false;
        let finalStatus: ProfileDataStatus | null = null;

        const publish = () => {
            if (generation !== generationRef.current) return;
            if (publishTimerRef.current) clearTimeout(publishTimerRef.current);
            publishPending = false;
            publishTimerRef.current = null;
            const nextSample = toTypedSample(
                createDistanceAwareSample(mutablePoints, profileLength)
            );
            const sortedBins = Array.from(mutableBins.values()).sort(
                (a, b) => a.binIndex - b.binIndex || a.segmentIndex - b.segmentIndex
            );
            const nextBins = new Array<ProfileBin>(sortedBins.length);
            let minElevation = Infinity;
            let maxElevation = -Infinity;
            for (let i = 0; i < sortedBins.length; i++) {
                const bin = sortedBins[i];
                minElevation = Math.min(minElevation, bin.min);
                maxElevation = Math.max(maxElevation, bin.max);
                nextBins[i] = {
                    distance: bin.binIndex * CSV_BIN_SIZE,
                    segmentIndex: bin.segmentIndex,
                    minElevation: bin.min,
                    maxElevation: bin.max,
                    groundElevation: bin.groundCount > 0 ? bin.groundSum / bin.groundCount : null,
                    minPoint: bin.minPoint,
                    maxPoint: bin.maxPoint,
                };
            }
            replaceSample(sampleRef.current, nextSample);
            replaceBins(binsRef.current, nextBins);
            summaryRef.current = createSummary(
                requestSegments,
                totalAccepted,
                nextSample.count,
                minElevation === Infinity ? null : minElevation,
                maxElevation === -Infinity ? null : maxElevation
            );
            if (finalStatus) setStatus(finalStatus);
            setRevision((value) => value + 1);
        };

        const schedulePublish = (delay = 750) => {
            if (publishPending) return;
            publishPending = true;
            publishTimerRef.current = setTimeout(publish, delay);
        };

        const scheduleFinalPublish = () => {
            if (publishTimerRef.current) clearTimeout(publishTimerRef.current);
            publishPending = true;
            publishTimerRef.current = setTimeout(publish, 0);
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
                    if (mutablePoints.length < MAX_RETAINED_POINTS) {
                        mutablePoints.push(point);
                    } else {
                        const replacement = Math.floor(Math.random() * totalAccepted);
                        if (replacement < MAX_RETAINED_POINTS) {
                            mutablePoints[replacement] = point;
                        }
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
                    if (finishedRequests === visiblePointclouds.length) {
                        finalStatus = totalAccepted > 0 ? 'ready' : 'empty';
                        scheduleFinalPublish();
                    }
                },
                onCancel: () => undefined,
            });
            requestsRef.current.push(request);
        }

        return () => {
            cancelRequests();
        };
    }, [geometryRevision, profile, viewerRef]);

    /* eslint-disable react-hooks/refs -- High-volume profile buffers keep stable identities so React DevTools does not clone their contents. */
    const sample = sampleRef.current;
    const bins = binsRef.current;
    const segments = segmentsRef.current;
    const summary = summaryRef.current;

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

    const result = { sample, bins, segments, status, summary, revision, exportToCsv };
    return result;
}
