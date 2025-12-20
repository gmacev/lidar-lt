import { useState } from 'react';
import { Switch } from '@/common/components/Switch';
import { Icon } from '@/common/components';
import type { PotreeViewer } from '@/common/types/potree';
import { EDL_DEFAULTS } from '@/features/Viewer/config';
import type { ViewerState } from '@/features/Viewer/config/viewerConfig';

interface EDLControlProps {
    viewerRef: React.RefObject<PotreeViewer | null>;
    initialState: ViewerState;
    updateUrl: (state: Partial<ViewerState>) => void;
}

export function EDLControl({ viewerRef, initialState, updateUrl }: EDLControlProps) {
    const [edlEnabled, setEdlEnabled] = useState(initialState.edlEnabled ?? EDL_DEFAULTS.enabled);
    const [edlStrength, setEdlStrength] = useState(
        initialState.edlStrength ?? EDL_DEFAULTS.strength
    );
    const [edlRadius, setEdlRadius] = useState(initialState.edlRadius ?? EDL_DEFAULTS.radius);

    const handleStrengthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseFloat(e.target.value);
        setEdlStrength(value);
        const viewer = viewerRef.current;
        if (viewer) {
            viewer.setEDLStrength(value);
        }
        updateUrl({ edlStrength: value });
    };

    const handleRadiusChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseFloat(e.target.value);
        setEdlRadius(value);
        const viewer = viewerRef.current;
        if (viewer) {
            viewer.setEDLRadius(value);
        }
        updateUrl({ edlRadius: value });
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white/90">EDL</span>
                <Switch
                    checked={edlEnabled}
                    onChange={(checked) => {
                        setEdlEnabled(checked);
                        const viewer = viewerRef.current;
                        if (viewer) {
                            viewer.setEDLEnabled(checked);
                        }
                        updateUrl({ edlEnabled: checked });
                    }}
                    icon={<Icon name="sun" size={14} strokeWidth={2.5} />}
                />
            </div>

            <div className={`flex flex-col gap-1 ${!edlEnabled ? 'opacity-40' : ''}`}>
                <label className="text-xs text-white/70">
                    Stiprumas: <span className="text-laser-green">{edlStrength.toFixed(1)}</span>
                </label>
                <input
                    type="range"
                    min="0.1"
                    max="10"
                    step="0.1"
                    value={edlStrength}
                    onChange={handleStrengthChange}
                    disabled={!edlEnabled}
                    className="w-full accent-laser-green disabled:cursor-not-allowed"
                />
            </div>
            <div className={`flex flex-col gap-1 ${!edlEnabled ? 'opacity-40' : ''}`}>
                <label className="text-xs text-white/70">
                    Spindulys: <span className="text-laser-green">{edlRadius.toFixed(1)}</span>
                </label>
                <input
                    type="range"
                    min="0.5"
                    max="10"
                    step="0.1"
                    value={edlRadius}
                    onChange={handleRadiusChange}
                    disabled={!edlEnabled}
                    className="w-full accent-laser-green disabled:cursor-not-allowed"
                />
            </div>
        </div>
    );
}
