import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import type { Measure, PotreeScene, PotreeViewer, Profile } from '@/common/types/potree';
import { cancelPotreeInsertion, useDoubleClickFinish } from './useMeasurementInteraction';

interface UseProfileToolOptions {
    viewerRef: RefObject<PotreeViewer | null>;
}

export type ProfilePhase = 'idle' | 'drawing' | 'ready';

interface UseProfileToolReturn {
    phase: ProfilePhase;
    activeProfile: Profile | null;
    toggleProfileMeasurement: () => void;
    startNewProfile: () => void;
    finishProfile: () => void;
    closeProfile: () => void;
    resetProfile: () => void;
    deleteLastPoint: () => void;
    setProfileWidth: (width: number) => void;
}

interface ExtendedPotreeScene extends PotreeScene {
    removeProfile?: (profile: Profile) => void;
}

const DEFAULT_WIDTH = 1;

function removeDuplicateTrailingProfilePoint(profile: Profile, tolerance = 0.01) {
    const { points } = profile;
    if (points.length < 2) return false;

    const previous = points[points.length - 2];
    const current = points[points.length - 1];
    if (previous.distanceTo(current) > tolerance) return false;

    profile.removeMarker(points.length - 1);
    return true;
}

export function useProfileTool({ viewerRef }: UseProfileToolOptions): UseProfileToolReturn {
    const [phase, setPhase] = useState<ProfilePhase>('idle');
    const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
    const activeProfileRef = useRef<Profile | null>(null);

    const removeProfile = useCallback(
        (profile: Profile | null) => {
            const viewer = viewerRef.current;
            if (!viewer || !profile) return;

            const scene = viewer.scene as ExtendedPotreeScene;
            if (scene.removeProfile) {
                scene.removeProfile(profile);
            } else {
                scene.removeMeasurement(profile as unknown as Measure);
            }
        },
        [viewerRef]
    );

    const startNewProfile = useCallback(() => {
        const viewer = viewerRef.current;
        if (!viewer?.profileTool) return;

        if (activeProfileRef.current) {
            cancelPotreeInsertion(viewer);
            removeProfile(activeProfileRef.current);
        }

        const profile = viewer.profileTool.startInsertion({
            width: DEFAULT_WIDTH,
            name: 'Profilis',
        });
        profile.setWidth(DEFAULT_WIDTH);
        activeProfileRef.current = profile;
        setActiveProfile(profile);
        setPhase('drawing');
    }, [removeProfile, viewerRef]);

    const finishProfile = useCallback(() => {
        const viewer = viewerRef.current;
        const profile = activeProfileRef.current;
        if (!viewer || !profile || phase !== 'drawing') return;

        cancelPotreeInsertion(viewer);
        removeDuplicateTrailingProfilePoint(profile);

        if (profile.points.length < 2) {
            removeProfile(profile);
            activeProfileRef.current = null;
            setActiveProfile(null);
            setPhase('idle');
            return;
        }

        setPhase('ready');
    }, [phase, removeProfile, viewerRef]);

    const closeProfile = useCallback(() => {
        const viewer = viewerRef.current;
        if (viewer) {
            cancelPotreeInsertion(viewer);
        }
        removeProfile(activeProfileRef.current);
        activeProfileRef.current = null;
        setActiveProfile(null);
        setPhase('idle');
    }, [removeProfile, viewerRef]);

    const toggleProfileMeasurement = useCallback(() => {
        if (phase === 'idle') {
            startNewProfile();
        } else {
            closeProfile();
        }
    }, [closeProfile, phase, startNewProfile]);

    const resetProfile = useCallback(() => {
        startNewProfile();
    }, [startNewProfile]);

    const deleteLastPoint = useCallback(() => {
        const profile = activeProfileRef.current;
        if (!profile) return;

        const index = phase === 'drawing' ? profile.points.length - 2 : profile.points.length - 1;
        if (index < 0) return;
        profile.removeMarker(index);

        if (phase === 'ready' && profile.points.length < 2) {
            setPhase('drawing');
        }
    }, [phase]);

    const setProfileWidth = useCallback((width: number) => {
        const profile = activeProfileRef.current;
        if (!profile || Math.abs(profile.width - width) < 0.001) return;
        profile.setWidth(width);
    }, []);

    useEffect(() => {
        if (phase !== 'drawing') return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                finishProfile();
            } else if (event.key === 'Backspace') {
                event.preventDefault();
                deleteLastPoint();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [deleteLastPoint, finishProfile, phase]);

    useDoubleClickFinish({
        viewerRef,
        isActive: phase === 'drawing',
        onFinish: finishProfile,
    });

    useEffect(() => {
        const element = viewerRef.current?.renderer.domElement;
        if (!element || phase !== 'drawing') return;

        const handlePointerFinish = (event: MouseEvent) => {
            if (event.button !== 2) return;
            queueMicrotask(() => {
                const profile = activeProfileRef.current;
                if (!profile) return;
                if (profile.points.length >= 2) {
                    setPhase('ready');
                } else {
                    closeProfile();
                }
            });
        };

        element.addEventListener('mouseup', handlePointerFinish);
        return () => element.removeEventListener('mouseup', handlePointerFinish);
    }, [closeProfile, phase, viewerRef]);

    useEffect(() => {
        return () => {
            const viewer = viewerRef.current;
            if (viewer) {
                cancelPotreeInsertion(viewer);
            }
            removeProfile(activeProfileRef.current);
            activeProfileRef.current = null;
        };
    }, [removeProfile, viewerRef]);

    return {
        phase,
        activeProfile,
        toggleProfileMeasurement,
        startNewProfile,
        finishProfile,
        closeProfile,
        resetProfile,
        deleteLastPoint,
        setProfileWidth,
    };
}
