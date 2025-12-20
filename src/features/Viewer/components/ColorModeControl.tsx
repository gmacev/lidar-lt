import { useState } from 'react';
import type { PotreeViewer, Potree } from '@/common/types/potree';
import {
    configureMaterialForElevation,
    configureMaterialForIntensity,
    configureMaterialForReturnNumber,
    type ColorMode,
} from '@/features/Viewer/config';
import type { ViewerState } from '@/features/Viewer/config/viewerConfig';

interface ColorModeControlProps {
    viewerRef: React.RefObject<PotreeViewer | null>;
    initialState: ViewerState;
    updateUrl: (state: Partial<ViewerState>) => void;
}

/* eslint-disable react-compiler/react-compiler */
export function ColorModeControl({ viewerRef, initialState, updateUrl }: ColorModeControlProps) {
    const [colorMode, setColorMode] = useState<ColorMode>(initialState.colorMode ?? 'elevation');
    const [intensityMax, setIntensityMax] = useState(initialState.intensityMax ?? 10000);

    const handleModeChange = (mode: ColorMode) => {
        const viewer = viewerRef.current;
        const PotreeLib: Potree | undefined = window.Potree;

        if (!viewer?.scene?.pointclouds?.length || !PotreeLib) return;

        const pointcloud = viewer.scene.pointclouds[0];

        if (mode === 'elevation') {
            configureMaterialForElevation(pointcloud, PotreeLib);
        } else if (mode === 'intensity') {
            configureMaterialForIntensity(pointcloud, PotreeLib);
            // Apply current intensity range
            pointcloud.material.intensityRange = [0, intensityMax];
        } else if (mode === 'return-number') {
            configureMaterialForReturnNumber(pointcloud, PotreeLib);
        }

        setColorMode(mode);
        updateUrl({ colorMode: mode });
    };

    const handleIntensityRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const maxVal = parseInt(e.target.value, 10);
        setIntensityMax(maxVal);

        const viewer = viewerRef.current;
        if (!viewer?.scene?.pointclouds?.length) return;

        const material = viewer.scene.pointclouds[0].material;
        material.intensityRange = [0, maxVal];
        material.needsUpdate = true;

        updateUrl({ intensityMax: maxVal });
    };

    const buttonClass = (mode: ColorMode) =>
        `flex-1 py-1.5 text-[11px] font-medium transition-all text-center ${
            colorMode === mode
                ? 'bg-laser-green/20 text-laser-green border-laser-green'
                : 'text-white/60 hover:text-white/80 border-white/20 hover:border-white/40 hover:bg-white/5'
        } border rounded`;

    return (
        <div className="flex flex-col gap-2">
            <span className="text-xs text-white/70">Spalvinimas</span>
            <div className="flex gap-1">
                <button
                    className={buttonClass('elevation')}
                    onClick={() => handleModeChange('elevation')}
                >
                    Aukštis
                </button>
                <button
                    className={buttonClass('intensity')}
                    onClick={() => handleModeChange('intensity')}
                >
                    Intensyvumas
                </button>
                <button
                    className={buttonClass('return-number')}
                    onClick={() => handleModeChange('return-number')}
                    title="Rodo lazerio grįžimus: 1-as = viršūnė, paskutinis = žemė"
                >
                    Grįžimai
                </button>
            </div>

            {/* Intensity range slider - only show when in intensity mode */}
            {colorMode === 'intensity' && (
                <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-white/10">
                    <label className="text-xs text-white/70 flex justify-between">
                        Kontrastas
                        <span className="text-laser-green">{intensityMax.toLocaleString()}</span>
                    </label>
                    <input
                        type="range"
                        min="0"
                        max="100000"
                        step="50"
                        value={intensityMax}
                        onChange={handleIntensityRangeChange}
                        className="w-full accent-laser-green"
                    />
                    <div className="flex justify-between text-[10px] text-white/40">
                        <span>Ryškus</span>
                        <span>Tamsus</span>
                    </div>
                </div>
            )}
        </div>
    );
}
