import { useState, useRef, useEffect, type RefObject } from 'react';
import type { PotreeViewer, BoxVolume } from '@/common/types/potree';
import { useMeasurementInteraction } from './useMeasurementInteraction';

interface UseVolumeMeasurementToolOptions {
    viewerRef: RefObject<PotreeViewer | null>;
}

interface UseVolumeMeasurementToolReturn {
    /** Whether a volume measurement is currently being inserted */
    isMeasuring: boolean;
    /** Total volume of all volumes in cubic meters */
    totalVolume: number;
    /** Toggle volume measurement - starts if not active, cancels if active */
    toggleVolumeMeasurement: () => void;
    /** Context menu position */
    menuPosition: { x: number; y: number } | null;
    /** Set context menu position */
    setMenuPosition: (pos: { x: number; y: number } | null) => void;
    /** Delete all volumes */
    deleteAll: () => void;
}

// Extended viewer type with event methods
interface ViewerWithEvents extends PotreeViewer {
    addEventListener: (type: string, callback: () => void) => void;
    removeEventListener: (type: string, callback: () => void) => void;
    dispatchEvent: (event: { type: string }) => void;
}

/**
 * Hook for volume measurement tool functionality.
 * Uses Potree's native volumeTool to create BoxVolume objects.
 */
export function useVolumeMeasurementTool({
    viewerRef,
}: UseVolumeMeasurementToolOptions): UseVolumeMeasurementToolReturn {
    const [isMeasuring, setIsMeasuring] = useState(false);
    const [totalVolume, setTotalVolume] = useState(0);

    // Track current active volume to manage it
    const activeVolumeRef = useRef<BoxVolume | null>(null);

    const { menuPosition, setMenuPosition } = useMeasurementInteraction({
        viewerRef,
        isMeasuring,
        blockRightClick: false,
    });

    const updateTotalVolume = () => {
        const viewer = viewerRef.current;
        if (!viewer?.scene?.volumes) {
            setTotalVolume(0);
            return;
        }

        // Sum up volumes of all BoxVolume objects
        const total = viewer.scene.volumes.reduce((sum, volume) => {
            if (typeof volume.getVolume === 'function') {
                return sum + volume.getVolume();
            }
            return sum;
        }, 0);

        setTotalVolume(total);
    };

    // Subscribe to viewer update events for continuous volume updates
    useEffect(() => {
        const viewer = viewerRef.current as ViewerWithEvents | null;
        if (!viewer) return;

        // Update on each render frame while measuring
        const handleUpdate = () => {
            if (isMeasuring) {
                updateTotalVolume();
            }
        };

        viewer.addEventListener('update', handleUpdate);
        return () => {
            viewer.removeEventListener('update', handleUpdate);
        };
    }, [isMeasuring, viewerRef]);

    const toggleVolumeMeasurement = () => {
        const viewer = viewerRef.current as ViewerWithEvents | null;
        if (!viewer?.volumeTool) {
            console.warn('VolumeTool not available');
            return;
        }

        // If already measuring, cancel it
        if (isMeasuring) {
            // Dispatch cancel_insertions to stop the tool
            viewer.dispatchEvent({ type: 'cancel_insertions' });

            // Remove the active volume if it exists
            if (activeVolumeRef.current) {
                viewer.scene.removeVolume(activeVolumeRef.current);
                activeVolumeRef.current = null;
            }

            setIsMeasuring(false);
            updateTotalVolume();
            return;
        }

        // Start new volume measurement
        setIsMeasuring(true);

        const volume = viewer.volumeTool.startInsertion({
            clip: false,
            name: 'Volume',
        });

        activeVolumeRef.current = volume;
    };

    const deleteAll = () => {
        const viewer = viewerRef.current;
        if (!viewer?.scene?.volumes) return;

        // Remove all volumes
        const volumesToRemove = [...viewer.scene.volumes];
        volumesToRemove.forEach((volume) => {
            viewer.scene.removeVolume(volume);
        });

        activeVolumeRef.current = null;
        setTotalVolume(0);

        // Restart if currently measuring
        if (isMeasuring && viewer.volumeTool) {
            const volume = viewer.volumeTool.startInsertion({
                clip: false,
                name: 'Volume',
            });
            activeVolumeRef.current = volume;
        }
    };

    return {
        isMeasuring,
        totalVolume,
        toggleVolumeMeasurement,
        menuPosition,
        setMenuPosition,
        deleteAll,
    };
}
