import { useState } from 'react';
import type { PotreeViewer } from '@/types/potree';
import { PERFORMANCE_DEFAULTS } from '@/features/Viewer/config';
import type { ViewerState } from '@/features/Viewer/config/viewerConfig';

interface NodeSizeControlProps {
    viewerRef: React.RefObject<PotreeViewer | null>;
    initialState: ViewerState;
    updateUrl: (state: Partial<ViewerState>) => void;
}

export function NodeSizeControl({ viewerRef, initialState, updateUrl }: NodeSizeControlProps) {
    const [minNodeSize, setMinNodeSize] = useState<number>(
        initialState.mns ?? PERFORMANCE_DEFAULTS.minNodeSize
    );

    const handleNodeSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const size = parseInt(e.target.value, 10);
        setMinNodeSize(size);

        // Update viewer setting
        const viewer = viewerRef.current;
        if (viewer) {
            viewer.setMinNodeSize(size);
        }
        updateUrl({ mns: size });
    };

    return (
        <div className="flex flex-col gap-2">
            <label className="text-xs text-white/70 flex justify-between">
                Detalumas (Min Node)
                <span className="text-laser-green">{minNodeSize}</span>
            </label>
            <input
                type="range"
                min="5"
                max="100" // 100 is very coarse, 5 is very fine
                step="5"
                value={minNodeSize}
                onChange={handleNodeSizeChange}
                className="w-full accent-laser-green dir-rtl"
            />
        </div>
    );
}
