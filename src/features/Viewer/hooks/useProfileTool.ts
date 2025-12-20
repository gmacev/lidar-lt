import { type RefObject, useEffect, useRef, useState } from 'react';
import type { Measure, PotreeScene, PotreeViewer, Profile } from '@/types/potree';

interface UseProfileToolOptions {
    viewerRef: RefObject<PotreeViewer | null>;
}

interface UseProfileToolReturn {
    isMeasuring: boolean;
    toggleProfileMeasurement: () => void;
    menuPosition: { x: number; y: number } | null;
    setMenuPosition: (pos: { x: number; y: number } | null) => void;
    resetProfile: () => void;
    deleteLastPoint: () => void;
}

// Helper interface to handle Potree's EventDispatcher behavior
interface DispatchableViewer {
    dispatchEvent: (event: { type: string }) => void;
}

// Extend PotreeScene locally to include removeProfile which might be missing from types
// but exists at runtime, or fallback to removeMeasurement
interface ExtendedPotreeScene extends PotreeScene {
    removeProfile?: (profile: Profile) => void;
}

/**
 * Hook for height profile tool functionality.
 * - Tracks whether user is actively drawing a profile
 * - Handles context menu on right-click
 */
export function useProfileTool({ viewerRef }: UseProfileToolOptions): UseProfileToolReturn {
    const [isMeasuring, setIsMeasuring] = useState(false);
    const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);

    // Track current active profile
    const activeProfileRef = useRef<Profile | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    // Helper to start insertion
    const startInsertion = () => {
        const viewer = viewerRef.current;
        if (!viewer?.profileTool) return;

        activeProfileRef.current = viewer.profileTool.startInsertion({
            width: 1, // Default width 1m
            name: 'Profilis',
        });
    };

    // Helper to safely remove a profile from the scene
    const removeActiveProfile = (viewer: PotreeViewer) => {
        if (!activeProfileRef.current) return;

        const scene = viewer.scene as ExtendedPotreeScene;

        if (scene.removeProfile) {
            scene.removeProfile(activeProfileRef.current);
        } else {
            // Fallback for older Potree versions: treat Profile as Measure
            // Casting to unknown first to avoid structural incompatibility complaints
            scene.removeMeasurement(activeProfileRef.current as unknown as Measure);
        }

        activeProfileRef.current = null;
    };

    // Reset profile (Clear all) but keep measuring
    const resetProfile = () => {
        const viewer = viewerRef.current;
        if (!viewer) return;

        // Remove current profile
        removeActiveProfile(viewer);

        // Restart insertion if we are supposed to be measuring
        if (isMeasuring) {
            startInsertion();
        }
    };

    // Toggle profile measurement (start or cancel)
    const toggleProfileMeasurement = () => {
        const viewer = viewerRef.current;
        if (!viewer?.profileTool) {
            console.warn('ProfileTool not available');
            return;
        }

        setMenuPosition(null);

        // If already measuring, cancel it
        if (isMeasuring) {
            // Dispatch cancel_insertions to stop the tool
            (viewer as unknown as DispatchableViewer).dispatchEvent({ type: 'cancel_insertions' });

            // Remove the incomplete profile
            removeActiveProfile(viewer);

            setIsMeasuring(false);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            return;
        }

        setIsMeasuring(true);
        startInsertion();

        // Safety timeout - clear after 120 seconds
        timeoutRef.current = setTimeout(() => {
            setIsMeasuring(false);
            activeProfileRef.current = null;
        }, 120000);
    };

    // Right-click handling for Context Menu (Capture phase to prevent Potree default cancel)
    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer || !isMeasuring) return;

        const renderer = viewer.renderer;
        if (!renderer?.domElement) return;

        const handleRightClick = (event: MouseEvent) => {
            if (event.button === 2) {
                // Prevent Potree from cancelling the insertion
                event.preventDefault();
                event.stopPropagation();

                setMenuPosition({ x: event.clientX, y: event.clientY });
            }
        };

        const handleContextMenu = (e: MouseEvent) => {
            e.preventDefault();
        };

        // Use capture phase to intercept before Potree
        renderer.domElement.addEventListener('mouseup', handleRightClick, { capture: true });
        // Also prevent context menu default browser behavior globally while measuring
        window.addEventListener('contextmenu', handleContextMenu, { capture: true });

        return () => {
            renderer.domElement.removeEventListener('mouseup', handleRightClick, { capture: true });
            window.removeEventListener('contextmenu', handleContextMenu, { capture: true });
        };
    }, [viewerRef, isMeasuring]);

    // Delete last point functionality
    const deleteLastPoint = () => {
        const profile = activeProfileRef.current;
        if (profile && profile.points && profile.points.length > 0) {
            // Use Potree's removeMarker to ensure visual elements and internal state are updated
            profile.removeMarker(profile.points.length - 1);
        }
    };

    // Listen for custom event to reset state when profile is closed from UI
    useEffect(() => {
        const handleProfileClosed = () => {
            setIsMeasuring(false);
            activeProfileRef.current = null;
            setMenuPosition(null);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };

        window.addEventListener('lidar:profile_closed', handleProfileClosed);
        return () => {
            window.removeEventListener('lidar:profile_closed', handleProfileClosed);
        };
    }, []);

    return {
        isMeasuring,
        toggleProfileMeasurement,
        menuPosition,
        setMenuPosition,
        resetProfile,
        deleteLastPoint,
    };
}
