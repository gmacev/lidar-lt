import { useState, useEffect, type RefObject } from 'react';
import type { PotreeViewer } from '@/common/types/potree';
import type { ViewerState } from '@/features/Viewer/config/viewerConfig';

interface ClassificationControlProps {
    viewerRef: RefObject<PotreeViewer | null>;
    initialState: ViewerState;
    updateUrl: (state: Partial<ViewerState>) => void;
}

interface ClassificationItem {
    id: number;
    name: string;
    description?: string;
    visible: boolean;
    color: [number, number, number, number];
}

const LT_CLASSIFICATIONS: Record<number, string> = {
    0: 'Neklasifikuoti',
    1: 'Neklasifikuoti',
    2: 'Žemė',
    3: 'Žema augmenija',
    4: 'Vidutinė augmenija',
    5: 'Aukšta augmenija',
    6: 'Pastatai',
    7: 'Triukšmas',
    8: 'Esminiai taškai',
    9: 'Vanduo',
    12: 'Persidengimas',
};

const DISPLAY_ORDER = [
    2, // Žemė
    3, // Žema augmenija
    4, // Vidutinė augmenija
    5, // Aukšta augmenija
    6, // Pastatai
    12, // Persidengimas
    0, // Neklasifikuoti (Master for 0 & 1)
    7, // Triukšmas
];

export function ClassificationControl({
    viewerRef,
    initialState,
    updateUrl,
}: ClassificationControlProps) {
    const [hiddenClasses, setHiddenClasses] = useState<Set<number>>(
        new Set(initialState.hiddenClasses ?? [])
    );

    // Initialize list immediately for UI - no layout shift!
    const classifications: ClassificationItem[] = DISPLAY_ORDER.map((id) => ({
        id,
        name: LT_CLASSIFICATIONS[id] || `Klasė ${id}`,
        visible: !hiddenClasses.has(id),
        color: [0, 0, 0, 1], // Dummy color, UI doesn't use it yet
    }));

    // Calculate "Select All" state
    const allVisible = classifications.every((c) => c.visible);
    const someVisible = classifications.some((c) => c.visible);
    const isIndeterminate = someVisible && !allVisible;

    // Periodically sync our state TO the Potree viewer
    useEffect(() => {
        const syncToPotree = () => {
            const viewer = viewerRef.current;
            if (!viewer || !viewer.scene || viewer.scene.pointclouds.length === 0) return;

            const material = viewer.scene.pointclouds[0].material;
            const classMap = material.classification;

            if (!classMap) return;

            let needsUpdate = false;

            // Apply our UI state to the Potree material
            DISPLAY_ORDER.forEach((id) => {
                const isHidden = hiddenClasses.has(id);
                const shouldBeVisible = !isHidden;

                // Handle Class 0 (Master) -> Also control Class 1
                if (id === 0) {
                    if (classMap[0] && classMap[0].visible !== shouldBeVisible) {
                        classMap[0].visible = shouldBeVisible;
                        needsUpdate = true;
                    }
                    if (classMap[1] && classMap[1].visible !== shouldBeVisible) {
                        classMap[1].visible = shouldBeVisible;
                        needsUpdate = true;
                    }
                } else {
                    // Normal classes
                    if (classMap[id] && classMap[id].visible !== shouldBeVisible) {
                        classMap[id].visible = shouldBeVisible;
                        needsUpdate = true;
                    }
                }
            });

            // If we made changes, update the GPU texture
            if (needsUpdate) {
                material.recomputeClassification();
            }
        };

        // Run sync frequently to catch when model loads or reloads
        const intervalId = setInterval(syncToPotree, 500);

        // Also run immediately in case it's already there
        syncToPotree();

        return () => clearInterval(intervalId);
    }, [viewerRef, hiddenClasses]);

    const toggleClassification = (id: number) => {
        setHiddenClasses((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }

            // Pass undefined when empty to remove from URL
            updateUrl({ hiddenClasses: newSet.size > 0 ? Array.from(newSet) : undefined });
            return newSet;
        });
    };

    const toggleAll = () => {
        if (allVisible) {
            // Hide all
            const newHidden = new Set(DISPLAY_ORDER);
            setHiddenClasses(newHidden);
            updateUrl({ hiddenClasses: Array.from(newHidden) });
        } else {
            // Show all (clear hidden)
            setHiddenClasses(new Set());
            updateUrl({ hiddenClasses: undefined });
        }
    };

    if (classifications.length === 0) return null;

    return (
        <div className="grid grid-flow-col grid-rows-5 gap-x-4 gap-y-1 pr-2">
            {classifications.map((item) => (
                <label
                    key={item.id}
                    className="flex items-center gap-1.5 text-xs text-white/80 hover:bg-white/5 rounded cursor-pointer select-none"
                >
                    <input
                        type="checkbox"
                        checked={item.visible}
                        onChange={() => toggleClassification(item.id)}
                        className="accent-neon-amber cursor-pointer"
                    />
                    <span className="truncate">{item.name}</span>
                </label>
            ))}

            {/* Select All Checkbox - spans remaining rows, distinct color */}
            <label className="row-span-2 flex items-center gap-2 text-sm font-medium text-white/90 hover:bg-white/5 rounded cursor-pointer select-none">
                <input
                    type="checkbox"
                    checked={allVisible}
                    ref={(input) => {
                        if (input) input.indeterminate = isIndeterminate;
                    }}
                    onChange={toggleAll}
                    className="w-4 h-4 accent-cyan-400 cursor-pointer"
                />
                <span>Visi taškai</span>
            </label>
        </div>
    );
}
