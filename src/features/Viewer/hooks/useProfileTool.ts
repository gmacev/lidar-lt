import { type RefObject, useEffect, useRef, useState } from 'react';
import type { Measure, PotreeScene, PotreeViewer, Profile } from '@/common/types/potree';
import { PROFILE_WIDTH_DEFAULTS } from '@/features/Viewer/config';
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
    const finishProfileRef = useRef<() => void>(() => undefined);
    const deleteLastPointRef = useRef<() => void>(() => undefined);
    const closeProfileRef = useRef<() => void>(() => undefined);

    const removeProfile = (profile: Profile | null) => {
        const viewer = viewerRef.current;
        if (!viewer || !profile) return;

        const scene = viewer.scene as ExtendedPotreeScene;
        if (scene.removeProfile) {
            scene.removeProfile(profile);
        } else {
            scene.removeMeasurement(profile as unknown as Measure);
        }
    };

    const startNewProfile = () => {
        const viewer = viewerRef.current;
        if (!viewer?.profileTool) return;

        if (activeProfileRef.current) {
            cancelPotreeInsertion(viewer);
            removeProfile(activeProfileRef.current);
        }

        const profile = viewer.profileTool.startInsertion({
            width: PROFILE_WIDTH_DEFAULTS.default,
            name: 'Profilis',
        });
        profile.setWidth(PROFILE_WIDTH_DEFAULTS.default);
        activeProfileRef.current = profile;
        setActiveProfile(profile);
        setPhase('drawing');
    };

    const finishProfile = () => {
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
    };

    const closeProfile = () => {
        const viewer = viewerRef.current;
        if (viewer) {
            cancelPotreeInsertion(viewer);
        }
        removeProfile(activeProfileRef.current);
        activeProfileRef.current = null;
        setActiveProfile(null);
        setPhase('idle');
    };

    const toggleProfileMeasurement = () => {
        if (phase === 'idle') {
            startNewProfile();
        } else {
            closeProfile();
        }
    };

    const resetProfile = () => {
        startNewProfile();
    };

    const deleteLastPoint = () => {
        const profile = activeProfileRef.current;
        if (!profile) return;

        const index = phase === 'drawing' ? profile.points.length - 2 : profile.points.length - 1;
        if (index < 0) return;
        profile.removeMarker(index);

        if (phase === 'ready' && profile.points.length < 2) {
            setPhase('drawing');
        }
    };

    const setProfileWidth = (width: number) => {
        const profile = activeProfileRef.current;
        if (!profile || Math.abs(profile.width - width) < 0.001) return;
        profile.setWidth(width);
    };

    useEffect(() => {
        finishProfileRef.current = finishProfile;
        deleteLastPointRef.current = deleteLastPoint;
        closeProfileRef.current = closeProfile;
    });

    useEffect(() => {
        if (phase !== 'drawing') return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                finishProfileRef.current();
            } else if (event.key === 'Backspace') {
                event.preventDefault();
                deleteLastPointRef.current();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [phase]);

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
                    closeProfileRef.current();
                }
            });
        };

        element.addEventListener('mouseup', handlePointerFinish);
        return () => element.removeEventListener('mouseup', handlePointerFinish);
    }, [phase, viewerRef]);

    useEffect(() => {
        return () => {
            const viewer = viewerRef.current;
            if (viewer) {
                cancelPotreeInsertion(viewer);
                const profile = activeProfileRef.current;
                if (profile) {
                    const scene = viewer.scene as ExtendedPotreeScene;
                    if (scene.removeProfile) {
                        scene.removeProfile(profile);
                    } else {
                        scene.removeMeasurement(profile as unknown as Measure);
                    }
                }
            }
            activeProfileRef.current = null;
        };
    }, [viewerRef]);

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
