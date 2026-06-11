import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PotreeViewer, Potree } from '@/common/types/potree';
import {
    configureMaterialForElevation,
    configureMaterialForIntensity,
    getAutoElevationRange,
    POINT_APPEARANCE_DEFAULTS,
    setElevationPalette,
    setManualElevationRange,
    type ColorMode,
    type ElevationPalette,
} from '@/features/Viewer/config';
import type { ViewerState } from '@/features/Viewer/config/viewerConfig';
import { useCommittedRange } from '@/features/Viewer/hooks/useCommittedRange';

type ElevationRangeMode = 'auto' | 'manual';

const ELEVATION_PALETTES: ElevationPalette[] = ['custom', 'terrain', 'grayscale'];
const COMMIT_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']);

const ELEVATION_PALETTE_GRADIENTS: Record<ElevationPalette, string> = {
    custom: 'linear-gradient(to right,#440154 0%,#31688e 30%,#35b779 58%,#fde725 78%,#ff9800 90%,#ff2600 100%)',
    terrain:
        'linear-gradient(to right,#123524 0%,#2d6a4f 20%,#74c69d 40%,#d6c96f 58%,#b08968 72%,#7f5539 86%,#f2f2f2 100%)',
    grayscale: 'linear-gradient(to right,#111111 0%,#f2f2f2 100%)',
};

interface ElevationRangeState {
    range: [number, number];
    bounds: [number, number];
}

interface ColorModeControlProps {
    viewerRef: React.RefObject<PotreeViewer | null>;
    initialState: ViewerState;
    updateUrl: (state: Partial<ViewerState>) => void;
}

function getPointCloudElevationBounds(
    pointcloud: PotreeViewer['scene']['pointclouds'][number] | undefined
): [number, number] | null {
    if (!pointcloud) return null;

    const posAttr = pointcloud.pcoGeometry?.pointAttributes?.attributes?.find(
        (attr) => attr.name === 'position'
    );

    const metadataRange = posAttr?.range;
    if (metadataRange) {
        const minZ = metadataRange[0][2];
        const maxZ = metadataRange[1][2];
        if (Number.isFinite(minZ) && Number.isFinite(maxZ) && maxZ > minZ) {
            return [minZ, maxZ];
        }
    }

    const box = pointcloud.boundingBox;
    if (box && Number.isFinite(box.min.z) && Number.isFinite(box.max.z) && box.max.z > box.min.z) {
        return [box.min.z, box.max.z];
    }

    return null;
}

export function ColorModeControl({ viewerRef, initialState, updateUrl }: ColorModeControlProps) {
    const { t } = useTranslation();
    const [colorMode, setColorMode] = useState<ColorMode>(initialState.colorMode ?? 'elevation');
    const [elevationPalette, setElevationPaletteState] = useState<ElevationPalette>(
        initialState.ep ?? POINT_APPEARANCE_DEFAULTS.elevationPalette
    );
    const [intensityMax, setIntensityMax] = useState(initialState.intensityMax ?? 10000);
    const [intensityGamma, setIntensityGamma] = useState(initialState.ig ?? 1);
    const [intensityBrightness, setIntensityBrightness] = useState(initialState.ib ?? 0);
    const hasInitialManualRange =
        typeof initialState.elevationMin === 'number' &&
        typeof initialState.elevationMax === 'number' &&
        initialState.elevationMax > initialState.elevationMin;
    const [elevationRangeMode, setElevationRangeMode] = useState<ElevationRangeMode>(
        hasInitialManualRange ? 'manual' : 'auto'
    );
    const [elevationRange, setElevationRange] = useState<ElevationRangeState | null>(
        hasInitialManualRange
            ? {
                  range: [initialState.elevationMin!, initialState.elevationMax!],
                  bounds: [initialState.elevationMin!, initialState.elevationMax!],
              }
            : null
    );
    const elevationRangeRef = useRef<ElevationRangeState | null>(elevationRange);
    const lastCommittedElevationRangeRef = useRef<[number, number] | null>(
        elevationRange?.range ?? null
    );
    const commitIntensityMax = useCommittedRange(intensityMax, (value) =>
        updateUrl({ intensityMax: value })
    );
    const commitIntensityGamma = useCommittedRange(intensityGamma, (value) =>
        updateUrl({ ig: value })
    );
    const commitIntensityBrightness = useCommittedRange(intensityBrightness, (value) =>
        updateUrl({ ib: value })
    );

    useEffect(() => {
        elevationRangeRef.current = elevationRange;
    }, [elevationRange]);

    const handleModeChange = (mode: ColorMode) => {
        const viewer = viewerRef.current;
        const PotreeLib: Potree | undefined = window.Potree;

        if (!viewer?.scene?.pointclouds?.length || !PotreeLib) return;

        const pointcloud = viewer.scene.pointclouds[0];
        const currentPointSize = pointcloud.material.size;
        const currentPointSizeType = pointcloud.material.pointSizeType;
        const currentPointShape = pointcloud.material.shape;

        if (mode === 'elevation') {
            configureMaterialForElevation(pointcloud, PotreeLib, {
                elevationRange:
                    elevationRangeMode === 'manual'
                        ? (elevationRange?.range ?? undefined)
                        : undefined,
                palette: elevationPalette,
            });
        } else if (mode === 'intensity') {
            configureMaterialForIntensity(pointcloud, PotreeLib);
            // Apply current intensity tuning
            // eslint-disable-next-line react-compiler/react-compiler
            pointcloud.material.intensityRange = [0, intensityMax];
            pointcloud.material.intensityGamma = intensityGamma;
            pointcloud.material.intensityBrightness = intensityBrightness;
        }

        pointcloud.material.size = currentPointSize;
        pointcloud.material.pointSizeType = currentPointSizeType;
        pointcloud.material.shape = currentPointShape;
        pointcloud.material.needsUpdate = true;

        setColorMode(mode);
        updateUrl({ colorMode: mode });
    };

    const handleElevationPaletteChange = (palette: ElevationPalette) => {
        setElevationPaletteState(palette);

        const viewer = viewerRef.current;
        if (viewer?.scene?.pointclouds) {
            for (const pointcloud of viewer.scene.pointclouds) {
                setElevationPalette(pointcloud, palette);
            }
        }

        updateUrl({ ep: palette });
    };

    useEffect(() => {
        if (colorMode !== 'elevation') return;

        const syncRange = () => {
            const pointcloud = viewerRef.current?.scene?.pointclouds?.[0];
            const material = pointcloud?.material;
            const range = material?.elevationRange;
            if (!range || !Number.isFinite(range[0]) || !Number.isFinite(range[1])) return;

            const metadataBounds = getPointCloudElevationBounds(pointcloud);
            const nextBounds: [number, number] = metadataBounds ?? [range[0], range[1]];

            setElevationRange((previous) => {
                if (elevationRangeMode === 'manual' && previous) {
                    const mergedBounds: [number, number] = [
                        Math.min(nextBounds[0], previous.range[0]),
                        Math.max(nextBounds[1], previous.range[1]),
                    ];

                    if (
                        Math.abs(previous.bounds[0] - mergedBounds[0]) < 0.01 &&
                        Math.abs(previous.bounds[1] - mergedBounds[1]) < 0.01
                    ) {
                        return previous;
                    }

                    return { ...previous, bounds: mergedBounds };
                }

                const nextRange: [number, number] = [range[0], range[1]];
                if (
                    previous &&
                    Math.abs(previous.range[0] - nextRange[0]) < 0.01 &&
                    Math.abs(previous.range[1] - nextRange[1]) < 0.01 &&
                    Math.abs(previous.bounds[0] - nextBounds[0]) < 0.01 &&
                    Math.abs(previous.bounds[1] - nextBounds[1]) < 0.01
                ) {
                    return previous;
                }

                return { range: nextRange, bounds: nextBounds };
            });
        };

        syncRange();
        const intervalId = window.setInterval(syncRange, 250);
        return () => window.clearInterval(intervalId);
    }, [colorMode, elevationRangeMode, viewerRef]);

    const handleIntensityRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const maxVal = parseInt(e.target.value, 10);
        setIntensityMax(maxVal);

        const viewer = viewerRef.current;
        if (!viewer?.scene?.pointclouds?.length) return;

        const material = viewer.scene.pointclouds[0].material;
        material.intensityRange = [0, maxVal];
        material.needsUpdate = true;
    };

    const handleIntensityGammaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseFloat(e.target.value);
        setIntensityGamma(value);

        const viewer = viewerRef.current;
        if (!viewer?.scene?.pointclouds?.length) return;

        const material = viewer.scene.pointclouds[0].material;
        material.intensityGamma = value;
        material.needsUpdate = true;
    };

    const handleIntensityBrightnessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseFloat(e.target.value);
        setIntensityBrightness(value);

        const viewer = viewerRef.current;
        if (!viewer?.scene?.pointclouds?.length) return;

        const material = viewer.scene.pointclouds[0].material;
        material.intensityBrightness = value;
        material.needsUpdate = true;
    };

    const commitElevationRangeUrl = () => {
        const range = elevationRangeRef.current?.range;
        if (!range) return;

        const lastCommitted = lastCommittedElevationRangeRef.current;
        if (
            lastCommitted &&
            Object.is(lastCommitted[0], range[0]) &&
            Object.is(lastCommitted[1], range[1])
        ) {
            return;
        }

        lastCommittedElevationRangeRef.current = [range[0], range[1]];
        updateUrl({ elevationMin: range[0], elevationMax: range[1] });
    };

    const handleElevationRangeKeyUp = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (COMMIT_KEYS.has(event.key)) {
            commitElevationRangeUrl();
        }
    };

    const applyManualElevationRange = (range: [number, number], commitUrl = true) => {
        setElevationRange((previous) => ({
            range,
            bounds: previous?.bounds ?? range,
        }));
        setElevationRangeMode('manual');

        const pointcloud = viewerRef.current?.scene?.pointclouds?.[0];
        if (pointcloud) {
            setManualElevationRange(pointcloud, range);
        }

        if (commitUrl) {
            lastCommittedElevationRangeRef.current = [range[0], range[1]];
            updateUrl({ elevationMin: range[0], elevationMax: range[1] });
        }
    };

    const handleElevationModeChange = (mode: ElevationRangeMode) => {
        setElevationRangeMode(mode);

        const pointcloud = viewerRef.current?.scene?.pointclouds?.[0];
        if (mode === 'auto') {
            if (pointcloud) {
                setManualElevationRange(pointcloud, null);
            }
            updateUrl({ elevationMin: undefined, elevationMax: undefined });
            return;
        }

        const currentRange = elevationRange?.range ?? pointcloud?.material.elevationRange;
        if (currentRange) {
            applyManualElevationRange([currentRange[0], currentRange[1]]);
        }
    };

    const handleElevationRangeSliderChange = (index: 0 | 1, value: string) => {
        if (!elevationRange) return;

        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) return;

        const [boundMin, boundMax] = elevationRange.bounds;
        const minGap = Math.max((boundMax - boundMin) * 0.01, 0.1);
        const nextRange: [number, number] = [...elevationRange.range];

        if (index === 0) {
            nextRange[0] = Math.min(numericValue, nextRange[1] - minGap);
        } else {
            nextRange[1] = Math.max(numericValue, nextRange[0] + minGap);
        }

        nextRange[0] = Math.max(boundMin, nextRange[0]);
        nextRange[1] = Math.min(boundMax, nextRange[1]);

        if (nextRange[1] <= nextRange[0]) {
            return;
        }

        applyManualElevationRange(nextRange, false);
    };

    const handleResetElevationRange = () => {
        const pointcloud = viewerRef.current?.scene?.pointclouds?.[0];
        const autoRange = pointcloud ? getAutoElevationRange(pointcloud) : null;
        const nextRange = autoRange ?? elevationRange?.range;

        if (nextRange) {
            applyManualElevationRange([nextRange[0], nextRange[1]]);
        }
    };

    const formatElevation = (value: number) => {
        const digits = Math.abs(value) >= 100 ? 0 : 1;
        return `${value.toFixed(digits)} m`;
    };

    const elevationRangePercent = (value: number) => {
        if (!elevationRange) return 0;

        const [boundMin, boundMax] = elevationRange.bounds;
        if (boundMax <= boundMin) return 0;

        return ((value - boundMin) / (boundMax - boundMin)) * 100;
    };

    const buttonClass = (mode: ColorMode) =>
        `flex-1 py-1.5 text-[11px] font-medium transition-all text-center ${
            colorMode === mode
                ? 'bg-laser-green/20 text-laser-green border-laser-green'
                : 'text-white/60 hover:text-white/80 border-white/20 hover:border-white/40 hover:bg-white/5'
        } border rounded`;

    return (
        <div className="flex flex-col gap-1">
            <span className="text-xs text-white/70">{t('colorMode.label')}</span>
            <div className="flex gap-1">
                <button
                    className={buttonClass('elevation')}
                    onClick={() => handleModeChange('elevation')}
                >
                    {t('colorMode.elevation')}
                </button>
                <button
                    className={buttonClass('intensity')}
                    onClick={() => handleModeChange('intensity')}
                >
                    {t('colorMode.intensity')}
                </button>
            </div>

            {colorMode === 'elevation' && elevationRange && (
                <div className="mt-2 flex flex-col gap-2 border-t border-white/10 pt-2">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-white/70">{t('colorMode.heightRange')}</span>
                        <div className="flex rounded border border-white/10 bg-black/20 p-0.5">
                            {(['auto', 'manual'] as const).map((mode) => (
                                <button
                                    key={mode}
                                    type="button"
                                    onClick={() => handleElevationModeChange(mode)}
                                    className={`rounded px-2 py-0.5 text-[10px] font-medium transition-all ${
                                        elevationRangeMode === mode
                                            ? 'bg-laser-green/20 text-laser-green'
                                            : 'text-white/50 hover:text-white/80'
                                    }`}
                                >
                                    {t(`colorMode.${mode}`)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <div
                            className="h-3 rounded-full"
                            style={{ background: ELEVATION_PALETTE_GRADIENTS[elevationPalette] }}
                        />
                        <div className="flex items-center justify-between text-[10px] text-white/55">
                            <span>{formatElevation(elevationRange.range[0])}</span>
                            <span>
                                {formatElevation(
                                    (elevationRange.range[0] + elevationRange.range[1]) / 2
                                )}
                            </span>
                            <span>{formatElevation(elevationRange.range[1])}</span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-white/70">{t('colorMode.palette')}</span>
                        <div className="grid grid-cols-3 gap-1">
                            {ELEVATION_PALETTES.map((palette) => (
                                <button
                                    key={palette}
                                    type="button"
                                    onClick={() => handleElevationPaletteChange(palette)}
                                    className={`rounded border px-2 py-1 text-[10px] font-medium transition-all ${
                                        elevationPalette === palette
                                            ? 'border-laser-green bg-laser-green/20 text-laser-green'
                                            : 'border-white/15 text-white/55 hover:border-white/35 hover:text-white/80'
                                    }`}
                                >
                                    {t(`colorMode.palettes.${palette}`)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {elevationRangeMode === 'manual' && (
                        <div className="flex flex-col gap-2">
                            <div className="relative h-8">
                                <div
                                    className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/15"
                                    style={{
                                        background: `linear-gradient(to right, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.15) ${elevationRangePercent(elevationRange.range[0])}%, rgba(0,255,136,0.65) ${elevationRangePercent(elevationRange.range[0])}%, rgba(0,255,136,0.65) ${elevationRangePercent(elevationRange.range[1])}%, rgba(255,255,255,0.15) ${elevationRangePercent(elevationRange.range[1])}%, rgba(255,255,255,0.15) 100%)`,
                                    }}
                                />
                                <input
                                    aria-label={t('colorMode.min')}
                                    type="range"
                                    min={elevationRange.bounds[0]}
                                    max={elevationRange.bounds[1]}
                                    step="0.1"
                                    value={elevationRange.range[0]}
                                    onChange={(event) =>
                                        handleElevationRangeSliderChange(0, event.target.value)
                                    }
                                    onBlur={commitElevationRangeUrl}
                                    onKeyUp={handleElevationRangeKeyUp}
                                    onPointerCancel={commitElevationRangeUrl}
                                    onPointerUp={commitElevationRangeUrl}
                                    className="range-thumb absolute inset-x-0 top-1/2 w-full -translate-y-1/2 bg-transparent accent-laser-green"
                                />
                                <input
                                    aria-label={t('colorMode.max')}
                                    type="range"
                                    min={elevationRange.bounds[0]}
                                    max={elevationRange.bounds[1]}
                                    step="0.1"
                                    value={elevationRange.range[1]}
                                    onChange={(event) =>
                                        handleElevationRangeSliderChange(1, event.target.value)
                                    }
                                    onBlur={commitElevationRangeUrl}
                                    onKeyUp={handleElevationRangeKeyUp}
                                    onPointerCancel={commitElevationRangeUrl}
                                    onPointerUp={commitElevationRangeUrl}
                                    className="range-thumb absolute inset-x-0 top-1/2 w-full -translate-y-1/2 bg-transparent accent-laser-green"
                                />
                            </div>

                            <div className="flex items-center justify-between gap-2 text-[10px] text-white/55">
                                <span>
                                    {t('colorMode.min')}: {formatElevation(elevationRange.range[0])}
                                </span>
                                <button
                                    type="button"
                                    onClick={handleResetElevationRange}
                                    className="rounded border border-white/10 px-2 py-0.5 text-white/50 transition-colors hover:border-laser-green/40 hover:text-laser-green"
                                >
                                    {t('colorMode.reset')}
                                </button>
                                <span>
                                    {t('colorMode.max')}: {formatElevation(elevationRange.range[1])}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Intensity range slider - only show when in intensity mode */}
            {colorMode === 'intensity' && (
                <div className="mt-2 flex flex-col gap-2 border-t border-white/10 pt-2">
                    <label className="flex justify-between text-xs text-white/70">
                        {t('colorMode.contrast')}
                        <span className="text-laser-green">{intensityMax.toLocaleString()}</span>
                    </label>
                    <input
                        type="range"
                        min="0"
                        max="100000"
                        step="50"
                        value={intensityMax}
                        onChange={handleIntensityRangeChange}
                        {...commitIntensityMax}
                        className="w-full accent-laser-green"
                    />
                    <label className="flex justify-between text-xs text-white/70">
                        {t('colorMode.gamma')}
                        <span className="text-laser-green">{intensityGamma.toFixed(2)}</span>
                    </label>
                    <input
                        type="range"
                        min="0.1"
                        max="4"
                        step="0.05"
                        value={intensityGamma}
                        onChange={handleIntensityGammaChange}
                        {...commitIntensityGamma}
                        className="w-full accent-laser-green"
                    />

                    <label className="flex justify-between text-xs text-white/70">
                        {t('colorMode.brightness')}
                        <span className="text-laser-green">{intensityBrightness.toFixed(2)}</span>
                    </label>
                    <input
                        type="range"
                        min="-1"
                        max="1"
                        step="0.05"
                        value={intensityBrightness}
                        onChange={handleIntensityBrightnessChange}
                        {...commitIntensityBrightness}
                        className="w-full accent-laser-green"
                    />
                </div>
            )}
        </div>
    );
}
