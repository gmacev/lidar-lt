import { useState, useEffect, type RefObject, useRef } from 'react';
import type { PotreeViewer, Profile, ProfileRequest, ProfileRequestEvent } from '@/types/potree';
import { Vector3 } from 'three';
import { throttle } from 'lodash';
import { downloadCsv } from '@/common/utils/downloadCsv';

interface UseProfileDataOptions {
    viewerRef: RefObject<PotreeViewer | null>;
}

export interface ProfilePoint {
    distance: number;
    minElevation: number;
    maxElevation: number;
    minPoint?: { x: number; y: number; z: number };
    maxPoint?: { x: number; y: number; z: number };
}

interface UseProfileDataReturn {
    data: ProfilePoint[];
    activeProfile: Profile | null;
    exportToCsv: (cellId: string) => void;
}

const BIN_SIZE = 0.2;

function smoothData(data: ProfilePoint[]): ProfilePoint[] {
    if (data.length < 3) return data;

    return data.map((point, i) => {
        if (i === 0 || i === data.length - 1) return point;
        const prev = data[i - 1];
        const next = data[i + 1];
        return {
            distance: point.distance,
            minElevation:
                prev.minElevation * 0.25 + point.minElevation * 0.5 + next.minElevation * 0.25,
            maxElevation:
                prev.maxElevation * 0.25 + point.maxElevation * 0.5 + next.maxElevation * 0.25,
            minPoint: point.minPoint,
            maxPoint: point.maxPoint,
        };
    });
}

export function useProfileData({ viewerRef }: UseProfileDataOptions): UseProfileDataReturn {
    const [data, setData] = useState<ProfilePoint[]>([]);
    const [activeProfile, setActiveProfile] = useState<Profile | null>(null);

    // Type the request ref correctly
    const requestRef = useRef<ProfileRequest | null>(null);
    const lastGeometryHashRef = useRef<string>('');

    const binsRef = useRef<
        Map<
            number,
            {
                min: number;
                max: number;
                minPt: { x: number; y: number; z: number };
                maxPt: { x: number; y: number; z: number };
            }
        >
    >(new Map());

    const throttleCancelRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer) return;

        const updateData = () => {
            // viewer.scene is now typed to include .profiles
            const profiles = viewer.scene.profiles;

            if (!profiles || profiles.length === 0) {
                if (activeProfile) {
                    setActiveProfile(null);
                    setData([]);
                    if (requestRef.current) {
                        requestRef.current.cancel();
                        requestRef.current = null;
                        lastGeometryHashRef.current = '';
                    }
                    binsRef.current.clear();
                }
                return;
            }

            const profile = profiles[0];

            // Generate hash safely
            const currentPointsHash =
                profile.points && profile.points.length > 0
                    ? profile.points
                          .map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}`)
                          .join('|')
                    : '';

            const hasGeometryChanged = lastGeometryHashRef.current !== currentPointsHash;
            const isNewProfile = activeProfile !== profile;
            const isRequestMissing = !requestRef.current;
            // Ensure points exist
            const isProfileValid = profile.points && profile.points.length >= 2;

            if (isProfileValid && (isNewProfile || isRequestMissing || hasGeometryChanged)) {
                lastGeometryHashRef.current = currentPointsHash;

                if (isNewProfile) {
                    setActiveProfile(profile);
                    setData([]);
                    binsRef.current.clear();
                }

                // Cleanup existing request
                if (requestRef.current) {
                    requestRef.current.cancel();

                    const pc = viewer.scene.pointclouds[0];
                    if (pc && pc.profileRequests) {
                        const idx = pc.profileRequests.indexOf(requestRef.current);
                        if (idx !== -1) pc.profileRequests.splice(idx, 1);
                    }
                }

                const pointcloud = viewer.scene.pointclouds[0];
                if (!pointcloud) return;

                // Access Potree from window safely
                const Potree = window.Potree;

                if (!Potree || !Potree.ProfileRequest) {
                    // Fallback to control points
                    if (profile.points && profile.points.length >= 2) {
                        const controlPointsData: ProfilePoint[] = [];
                        let runningDist = 0;
                        for (let i = 0; i < profile.points.length; i++) {
                            const p = profile.points[i];
                            if (i > 0) runningDist += p.distanceTo(profile.points[i - 1]);
                            controlPointsData.push({
                                distance: runningDist,
                                minElevation: p.z,
                                maxElevation: p.z,
                                minPoint: { x: p.x, y: p.y, z: p.z },
                                maxPoint: { x: p.x, y: p.y, z: p.z },
                            });
                        }
                        setData(controlPointsData);
                        binsRef.current.clear();
                    }
                    return;
                }

                if (throttleCancelRef.current) throttleCancelRef.current();

                const throttledUpdate = throttle(
                    () => {
                        const sortedBins = Array.from(binsRef.current.entries())
                            .map(([index, stats]) => ({
                                distance: index * BIN_SIZE,
                                minElevation: stats.min,
                                maxElevation: stats.max,
                                minPoint: stats.minPt,
                                maxPoint: stats.maxPt,
                            }))
                            .sort((a, b) => a.distance - b.distance);

                        const smoothed = smoothData(sortedBins);
                        setData(smoothed);
                    },
                    500,
                    { leading: true, trailing: true }
                );

                throttleCancelRef.current = () => throttledUpdate.cancel();

                const maxDepth = 15;

                // Construct request with strictly typed callback
                const request = new Potree.ProfileRequest(pointcloud, profile, maxDepth, {
                    onProgress: (event: ProfileRequestEvent) => {
                        let currentSegmentStartDistance = 0;

                        if (event.points && event.points.segments) {
                            for (const segment of event.points.segments) {
                                const numPoints = segment.points.numPoints;
                                const start = new Vector3(
                                    segment.start.x,
                                    segment.start.y,
                                    segment.start.z
                                );
                                const startGround = new Vector3(start.x, start.y, 0);
                                const positions = segment.points.data.position;

                                for (let i = 0; i < numPoints; i++) {
                                    const x = positions[i * 3];
                                    const y = positions[i * 3 + 1];
                                    const z = positions[i * 3 + 2];

                                    const pLocal = new Vector3(x, y, z);
                                    // Matrix4 type assertion usually not needed if Three types are clean,
                                    // but pointcloud.matrixWorld is defined in our extended type now.
                                    const pWorld = pLocal.applyMatrix4(pointcloud.matrixWorld);

                                    const pt = { x: pWorld.x, y: pWorld.y, z: pWorld.z };
                                    const pGround = new Vector3(pWorld.x, pWorld.y, 0);
                                    const distOnSegment = pGround.distanceTo(startGround);
                                    const totalDist = currentSegmentStartDistance + distOnSegment;

                                    const binIndex = Math.floor(totalDist / BIN_SIZE);
                                    const existing = binsRef.current.get(binIndex);

                                    if (existing) {
                                        if (pWorld.z < existing.min) {
                                            existing.min = pWorld.z;
                                            existing.minPt = pt;
                                        }
                                        if (pWorld.z > existing.max) {
                                            existing.max = pWorld.z;
                                            existing.maxPt = pt;
                                        }
                                    } else {
                                        binsRef.current.set(binIndex, {
                                            min: pWorld.z,
                                            max: pWorld.z,
                                            minPt: pt,
                                            maxPt: pt,
                                        });
                                    }
                                }
                                currentSegmentStartDistance += segment.length;
                            }
                        }
                        throttledUpdate();
                    },
                    onFinish: () => {
                        throttledUpdate.flush();
                    },
                    cancel: () => {
                        throttledUpdate.cancel();
                    },
                    onCancel: () => {
                        throttledUpdate.cancel();
                    },
                });

                requestRef.current = request;
                pointcloud.profileRequests.push(request);
            }
        };

        const interval = setInterval(updateData, 500);

        return () => {
            clearInterval(interval);
            if (throttleCancelRef.current) {
                throttleCancelRef.current();
            }
            if (requestRef.current) {
                requestRef.current.cancel();
                const pc = viewer.scene.pointclouds[0];
                if (pc && pc.profileRequests) {
                    const idx = pc.profileRequests.indexOf(requestRef.current);
                    if (idx !== -1) pc.profileRequests.splice(idx, 1);
                }
            }
        };
    }, [viewerRef, activeProfile]);

    const exportToCsv = (cellId: string) => {
        if (!data || data.length === 0) return;

        const header = 'Distance_m,Ground_Z_m,Top_Z_m,Ground_X,Ground_Y,Top_X,Top_Y\n';
        const rows = data
            .map((p) => {
                const minX = p.minPoint?.x.toFixed(3) ?? '';
                const minY = p.minPoint?.y.toFixed(3) ?? '';
                const maxX = p.maxPoint?.x.toFixed(3) ?? '';
                const maxY = p.maxPoint?.y.toFixed(3) ?? '';
                return `${p.distance.toFixed(3)},${p.minElevation.toFixed(3)},${p.maxElevation.toFixed(3)},${minX},${minY},${maxX},${maxY}`;
            })
            .join('\n');

        const content = header + rows;
        downloadCsv(content, `profile_${cellId}_${new Date().toISOString().slice(0, 10)}.csv`);
    };

    return { data, activeProfile, exportToCsv };
}
