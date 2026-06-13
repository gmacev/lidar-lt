import {
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type PointerEvent as ReactPointerEvent,
    type RefObject,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Mesh, MeshBasicMaterial, SphereGeometry } from 'three';
import type { PotreeViewer } from '@/common/types/potree';
import type {
    ProfileBin,
    ProfileDataStatus,
    ProfileSample,
    ProfileSegment,
    ProfileSummary,
} from '@/features/Viewer/hooks/useProfileData';
import type { ProfilePhase } from '@/features/Viewer/hooks/useProfileTool';
import { Icon } from '@/common/components';

interface HeightProfilePanelProps {
    viewerRef: RefObject<PotreeViewer | null>;
    phase: ProfilePhase;
    sample: ProfileSample;
    bins: ProfileBin[];
    segments: ProfileSegment[];
    status: ProfileDataStatus;
    summary: ProfileSummary;
    revision: number;
    width: number;
    onWidthChange: (width: number) => void;
    onFinish: () => void;
    onNewProfile: () => void;
    onDeleteLast: () => void;
    onExport: () => void;
    onClose: () => void;
    onCollapsedChange: (collapsed: boolean) => void;
    sidebarVisible: boolean;
}

interface ViewBounds {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}

interface ProjectionCache {
    x: Float32Array;
    y: Float32Array;
    cells: Map<string, number[]>;
    bounds: ViewBounds;
    plot: { left: number; top: number; width: number; height: number };
}

const EMPTY_BOUNDS: ViewBounds = { minX: 0, maxX: 1, minY: 0, maxY: 1 };
const CELL_SIZE = 16;
const GROUND_TRACE_MAX_GAP_METERS = 1;
const POINT_COLORS = ['#3b528b', '#21918c', '#5ec962', '#fde725', '#ffb000', '#ef6c42'] as const;

function niceStep(range: number, targetTicks: number) {
    const rough = range / Math.max(1, targetTicks);
    const power = 10 ** Math.floor(Math.log10(Math.max(rough, Number.EPSILON)));
    const normalized = rough / power;
    const factor = normalized >= 5 ? 5 : normalized >= 2 ? 2 : 1;
    return factor * power;
}

function fitBounds(sample: ProfileSample, summary: ProfileSummary): ViewBounds {
    if (sample.count === 0 || summary.length <= 0) return EMPTY_BOUNDS;

    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < sample.count; i++) {
        min = Math.min(min, sample.elevation[i]);
        max = Math.max(max, sample.elevation[i]);
    }
    const padding = Math.max(0.5, (max - min) * 0.08);
    return {
        minX: 0,
        maxX: Math.max(1, summary.length),
        minY: min - padding,
        maxY: max + padding,
    };
}

function isClassificationVisible(viewer: PotreeViewer | null, classification: number) {
    const entry = viewer?.scene.pointclouds[0]?.material.classification[classification];
    if (!entry) return true;
    return entry.visible !== false && entry.color[3] !== 0;
}

function formatMeters(value: number | null, digits = 1) {
    return value === null ? '—' : `${value.toFixed(digits)} m`;
}

export function HeightProfilePanel({
    viewerRef,
    phase,
    sample,
    bins,
    segments,
    status,
    summary,
    revision,
    width,
    onWidthChange,
    onFinish,
    onNewProfile,
    onDeleteLast,
    onExport,
    onClose,
    onCollapsedChange,
    sidebarVisible,
}: HeightProfilePanelProps) {
    const { t } = useTranslation();
    const containerRef = useRef<HTMLDivElement>(null);
    const dataCanvasRef = useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const tooltipDistanceRef = useRef<HTMLSpanElement>(null);
    const tooltipElevationRef = useRef<HTMLSpanElement>(null);
    const tooltipDetailsRef = useRef<HTMLDivElement>(null);
    const cacheRef = useRef<ProjectionCache | null>(null);
    const viewRef = useRef<ViewBounds>(EMPTY_BOUNDS);
    const hasFittedRef = useRef(false);
    const userAdjustedViewRef = useRef(false);
    const pointerFrameRef = useRef<number | null>(null);
    const redrawFrameRef = useRef<number | null>(null);
    const markerRef = useRef<Mesh | null>(null);
    const dragRef = useRef<{ x: number; y: number; bounds: ViewBounds } | null>(null);
    const [collapsed, setCollapsed] = useState(false);
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
    const [widthInput, setWidthInput] = useState(width);
    const widthTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const onWidthChangeRef = useRef(onWidthChange);

    useEffect(() => {
        onWidthChangeRef.current = onWidthChange;
    }, [onWidthChange]);

    useEffect(() => {
        return () => {
            if (widthTimeoutRef.current) clearTimeout(widthTimeoutRef.current);
        };
    }, []);

    useLayoutEffect(() => {
        const element = containerRef.current;
        if (!element || collapsed) return;

        const update = () =>
            setCanvasSize({ width: element.clientWidth, height: element.clientHeight });
        update();
        const observer = new ResizeObserver(update);
        observer.observe(element);
        return () => observer.disconnect();
    }, [collapsed]);

    const scheduleRedraw = () => {
        if (redrawFrameRef.current !== null) return;
        redrawFrameRef.current = requestAnimationFrame(() => {
            redrawFrameRef.current = null;
            setCanvasSize((size) => ({ ...size }));
        });
    };

    const clearSelection = () => {
        const overlay = overlayCanvasRef.current;
        if (overlay) {
            const context = overlay.getContext('2d');
            context?.clearRect(0, 0, overlay.width, overlay.height);
        }
        if (tooltipRef.current) tooltipRef.current.hidden = true;
        const marker = markerRef.current;
        const viewer = viewerRef.current;
        if (marker && viewer) viewer.scene.scene.remove(marker);
    };

    useEffect(() => {
        return () => {
            if (redrawFrameRef.current !== null) cancelAnimationFrame(redrawFrameRef.current);
            clearSelection();
            markerRef.current?.geometry.dispose();
            (markerRef.current?.material as MeshBasicMaterial | undefined)?.dispose();
        };
    }, []);

    useEffect(() => {
        if (sample.count === 0) {
            viewRef.current = EMPTY_BOUNDS;
            return;
        }
        if (!hasFittedRef.current || !userAdjustedViewRef.current) {
            viewRef.current = fitBounds(sample, summary);
            hasFittedRef.current = true;
        }
    }, [revision, sample, summary]);

    useEffect(() => {
        if (collapsed || canvasSize.width === 0 || canvasSize.height === 0) return;
        const canvas = dataCanvasRef.current;
        const overlay = overlayCanvasRef.current;
        if (!canvas || !overlay) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
        for (const target of [canvas, overlay]) {
            const nextWidth = Math.floor(canvasSize.width * dpr);
            const nextHeight = Math.floor(canvasSize.height * dpr);
            if (target.width !== nextWidth || target.height !== nextHeight) {
                target.width = nextWidth;
                target.height = nextHeight;
                target.style.width = `${canvasSize.width}px`;
                target.style.height = `${canvasSize.height}px`;
            }
        }

        const context = canvas.getContext('2d');
        if (!context) return;
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.clearRect(0, 0, canvasSize.width, canvasSize.height);

        const plot = {
            left: 64,
            top: 12,
            width: Math.max(1, canvasSize.width - 80),
            height: Math.max(1, canvasSize.height - 60),
        };
        const bounds = viewRef.current;
        const scaleX = (value: number) =>
            plot.left + ((value - bounds.minX) / (bounds.maxX - bounds.minX)) * plot.width;
        const scaleY = (value: number) =>
            plot.top + (1 - (value - bounds.minY) / (bounds.maxY - bounds.minY)) * plot.height;

        context.fillStyle = '#050708';
        context.fillRect(0, 0, canvasSize.width, canvasSize.height);
        context.strokeStyle = 'rgba(255,255,255,0.08)';
        context.fillStyle = 'rgba(255,255,255,0.52)';
        context.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
        context.lineWidth = 1;

        const xStep = niceStep(bounds.maxX - bounds.minX, plot.width / 90);
        const yStep = niceStep(bounds.maxY - bounds.minY, plot.height / 45);
        context.beginPath();
        for (
            let value = Math.ceil(bounds.minX / xStep) * xStep;
            value <= bounds.maxX;
            value += xStep
        ) {
            const x = Math.round(scaleX(value)) + 0.5;
            context.moveTo(x, plot.top);
            context.lineTo(x, plot.top + plot.height);
            const label = value.toFixed(xStep < 1 ? 1 : 0);
            const labelWidth = context.measureText(label).width;
            const labelX = Math.max(
                plot.left,
                Math.min(x - labelWidth / 2, plot.left + plot.width - labelWidth)
            );
            context.fillText(label, labelX, plot.top + plot.height + 18);
        }
        for (
            let value = Math.ceil(bounds.minY / yStep) * yStep;
            value <= bounds.maxY;
            value += yStep
        ) {
            const y = Math.round(scaleY(value)) + 0.5;
            context.moveTo(plot.left, y);
            context.lineTo(plot.left + plot.width, y);
            context.save();
            context.textAlign = 'right';
            context.fillText(value.toFixed(yStep < 1 ? 1 : 0), plot.left - 8, y + 4);
            context.restore();
        }
        context.stroke();

        const controlPoints = [
            { label: 'P1', distance: 0 },
            ...(phase === 'drawing' ? segments.slice(0, -1) : segments).map((segment) => ({
                label: `P${segment.index + 2}`,
                distance: segment.endDistance,
            })),
        ];
        for (const controlPoint of controlPoints) {
            const x = scaleX(controlPoint.distance);
            if (x < plot.left || x > plot.left + plot.width) continue;
            context.strokeStyle = 'rgba(255,184,0,0.32)';
            context.setLineDash([4, 4]);
            context.beginPath();
            context.moveTo(x, plot.top);
            context.lineTo(x, plot.top + plot.height);
            context.stroke();
            context.setLineDash([]);
            context.fillStyle = 'rgba(255,184,0,0.8)';
            const labelWidth = context.measureText(controlPoint.label).width;
            const labelX = x + labelWidth + 8 > plot.left + plot.width ? x - labelWidth - 4 : x + 4;
            context.fillText(controlPoint.label, labelX, plot.top + 12);
        }

        const projectedX = new Float32Array(sample.count);
        const projectedY = new Float32Array(sample.count);
        const cells = new Map<string, number[]>();
        const viewer = viewerRef.current;
        const colorPaths = POINT_COLORS.map(() => new Path2D());
        const colorMin = summary.minElevation ?? bounds.minY;
        const colorMax = summary.maxElevation ?? bounds.maxY;
        for (let i = 0; i < sample.count; i++) {
            if (!isClassificationVisible(viewer, sample.classification[i])) continue;
            const x = scaleX(sample.mileage[i]);
            const y = scaleY(sample.elevation[i]);
            projectedX[i] = x;
            projectedY[i] = y;
            if (
                x < plot.left ||
                x > plot.left + plot.width ||
                y < plot.top ||
                y > plot.top + plot.height
            ) {
                continue;
            }
            const colorIndex = Math.min(
                POINT_COLORS.length - 1,
                Math.max(
                    0,
                    Math.floor(
                        ((sample.elevation[i] - colorMin) / Math.max(0.001, colorMax - colorMin)) *
                            POINT_COLORS.length
                    )
                )
            );
            colorPaths[colorIndex].rect(x, y, 1.35, 1.35);
            const key = `${Math.floor(x / CELL_SIZE)}:${Math.floor(y / CELL_SIZE)}`;
            const bucket = cells.get(key);
            if (bucket) bucket.push(i);
            else cells.set(key, [i]);
        }
        context.save();
        context.beginPath();
        context.rect(plot.left, plot.top, plot.width, plot.height);
        context.clip();
        context.globalAlpha = 0.82;
        for (let i = 0; i < colorPaths.length; i++) {
            context.fillStyle = POINT_COLORS[i];
            context.fill(colorPaths[i]);
        }
        context.globalAlpha = 1;

        if (bins.length > 1) {
            context.strokeStyle = '#70d6a3';
            context.lineWidth = 1.5;
            context.beginPath();
            let previousGround: ProfileBin | null = null;
            for (const point of bins) {
                if (point.groundElevation === null) continue;
                const x = scaleX(point.distance);
                const y = scaleY(point.groundElevation);
                const startsNewTrace =
                    previousGround === null ||
                    point.segmentIndex !== previousGround.segmentIndex ||
                    point.distance - previousGround.distance > GROUND_TRACE_MAX_GAP_METERS;
                if (startsNewTrace) {
                    context.moveTo(x, y);
                } else {
                    context.lineTo(x, y);
                }
                previousGround = point;
            }
            context.stroke();
        }
        context.restore();

        context.strokeStyle = 'rgba(255,255,255,0.24)';
        context.strokeRect(plot.left + 0.5, plot.top + 0.5, plot.width, plot.height);
        context.fillStyle = 'rgba(255,255,255,0.48)';
        context.save();
        context.textAlign = 'right';
        context.fillText(t('profile.distanceAxis'), plot.left + plot.width, canvasSize.height - 7);
        context.restore();
        context.save();
        context.textAlign = 'center';
        context.translate(14, plot.top + plot.height / 2);
        context.rotate(-Math.PI / 2);
        context.fillText(t('profile.elevationAxis'), 0, 0);
        context.restore();

        cacheRef.current = { x: projectedX, y: projectedY, cells, bounds, plot };
        clearSelection();
    }, [bins, canvasSize, collapsed, phase, revision, sample, segments, t, viewerRef]);

    useEffect(() => {
        const viewer = viewerRef.current;
        const materials = viewer?.scene.pointclouds.map((pointcloud) => pointcloud.material) ?? [];
        const redraw = () => scheduleRedraw();
        for (const material of materials)
            material.addEventListener?.('material_property_changed', redraw);
        return () => {
            for (const material of materials) {
                material.removeEventListener?.('material_property_changed', redraw);
            }
        };
    }, [viewerRef]);

    const showPoint = (index: number, clientX: number, clientY: number) => {
        const cache = cacheRef.current;
        const overlay = overlayCanvasRef.current;
        const tooltip = tooltipRef.current;
        const viewer = viewerRef.current;
        if (!cache || !overlay || !tooltip || !viewer) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
        const context = overlay.getContext('2d');
        if (!context) return;
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.clearRect(0, 0, overlay.width / dpr, overlay.height / dpr);
        const x = cache.x[index];
        const y = cache.y[index];
        context.strokeStyle = 'rgba(255,184,0,0.72)';
        context.beginPath();
        context.moveTo(x, cache.plot.top);
        context.lineTo(x, cache.plot.top + cache.plot.height);
        context.moveTo(cache.plot.left, y);
        context.lineTo(cache.plot.left + cache.plot.width, y);
        context.stroke();
        context.fillStyle = '#ffb800';
        context.beginPath();
        context.arc(x, y, 3.5, 0, Math.PI * 2);
        context.fill();

        const segmentIndex = sample.segmentIndex[index];
        tooltip.hidden = false;
        const tooltipX = Math.max(8, Math.min(clientX + 12, overlay.clientWidth - 244));
        tooltip.style.transform = `translate(${tooltipX}px, ${Math.max(8, clientY - 100)}px)`;
        if (tooltipDistanceRef.current) {
            tooltipDistanceRef.current.textContent = `${sample.mileage[index].toFixed(2)} m`;
        }
        if (tooltipElevationRef.current) {
            tooltipElevationRef.current.textContent = `${sample.elevation[index].toFixed(2)} m`;
        }
        if (tooltipDetailsRef.current) {
            tooltipDetailsRef.current.textContent = `${t('profile.segment')} P${segmentIndex + 1}–P${segmentIndex + 2} · ${t('profile.classification')} ${sample.classification[index]}`;
        }

        let marker = markerRef.current;
        if (!marker) {
            marker = new Mesh(
                new SphereGeometry(0.35, 12, 12),
                new MeshBasicMaterial({ color: 0xffb800, depthTest: false })
            );
            marker.renderOrder = 1000;
            markerRef.current = marker;
        }
        marker.position.set(sample.x[index], sample.y[index], sample.displayElevation[index]);
        if (!viewer.scene.scene.children.includes(marker)) viewer.scene.scene.add(marker);
        const camera = viewer.scene.getActiveCamera();
        const distance = marker.position.distanceTo(camera.position);
        marker.scale.setScalar(Math.max(0.5, distance * 0.006));
    };

    const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        if (dragRef.current) {
            const cache = cacheRef.current;
            if (!cache) return;
            userAdjustedViewRef.current = true;
            const dx = event.clientX - dragRef.current.x;
            const dy = event.clientY - dragRef.current.y;
            const { bounds } = dragRef.current;
            const xShift = (-dx / cache.plot.width) * (bounds.maxX - bounds.minX);
            const yShift = (dy / cache.plot.height) * (bounds.maxY - bounds.minY);
            viewRef.current = {
                minX: bounds.minX + xShift,
                maxX: bounds.maxX + xShift,
                minY: bounds.minY + yShift,
                maxY: bounds.maxY + yShift,
            };
            scheduleRedraw();
            return;
        }

        if (pointerFrameRef.current !== null) cancelAnimationFrame(pointerFrameRef.current);
        const currentTarget = event.currentTarget;
        const clientX = event.clientX;
        const clientY = event.clientY;
        pointerFrameRef.current = requestAnimationFrame(() => {
            pointerFrameRef.current = null;
            const cache = cacheRef.current;
            if (!cache) return;
            const rect = currentTarget.getBoundingClientRect();
            const x = clientX - rect.left;
            const y = clientY - rect.top;
            const cellX = Math.floor(x / CELL_SIZE);
            const cellY = Math.floor(y / CELL_SIZE);
            let closest = -1;
            let closestDistance = 10;
            for (let ox = -1; ox <= 1; ox++) {
                for (let oy = -1; oy <= 1; oy++) {
                    const bucket = cache.cells.get(`${cellX + ox}:${cellY + oy}`) ?? [];
                    for (const index of bucket) {
                        const distance = Math.hypot(cache.x[index] - x, cache.y[index] - y);
                        if (distance < closestDistance) {
                            closest = index;
                            closestDistance = distance;
                        }
                    }
                }
            }
            if (closest >= 0) showPoint(closest, x, y);
            else clearSelection();
        });
    };

    const handleWheel = (event: WheelEvent) => {
        event.preventDefault();
        const cache = cacheRef.current;
        if (!cache) return;
        userAdjustedViewRef.current = true;
        const canvas = overlayCanvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const px = event.clientX - rect.left;
        const py = event.clientY - rect.top;
        const fx = (px - cache.plot.left) / cache.plot.width;
        const fy = 1 - (py - cache.plot.top) / cache.plot.height;
        const bounds = viewRef.current;
        const anchorX = bounds.minX + fx * (bounds.maxX - bounds.minX);
        const anchorY = bounds.minY + fy * (bounds.maxY - bounds.minY);
        const factor = event.deltaY < 0 ? 0.85 : 1.18;
        const width = (bounds.maxX - bounds.minX) * factor;
        const height = (bounds.maxY - bounds.minY) * factor;
        viewRef.current = {
            minX: anchorX - fx * width,
            maxX: anchorX + (1 - fx) * width,
            minY: anchorY - fy * height,
            maxY: anchorY + (1 - fy) * height,
        };
        scheduleRedraw();
    };

    useEffect(() => {
        const canvas = overlayCanvasRef.current;
        if (!canvas || collapsed) return;

        canvas.addEventListener('wheel', handleWheel, { passive: false });
        return () => canvas.removeEventListener('wheel', handleWheel);
    });

    const resetView = () => {
        viewRef.current = fitBounds(sample, summary);
        userAdjustedViewRef.current = false;
        scheduleRedraw();
    };

    return (
        <section
            className={`absolute bottom-0 right-0 z-40 border-t border-white/15 bg-[#080b0d]/[0.97] shadow-[0_-18px_50px_rgba(0,0,0,0.45)] transition-[left] duration-300 ${
                sidebarVisible ? 'left-80' : 'left-0'
            } ${collapsed ? 'h-11' : 'h-[clamp(240px,34dvh,360px)]'}`}
            aria-label={t('profile.title')}
        >
            <header className="flex h-11 items-center gap-3 border-b border-white/10 px-3">
                <div className="flex min-w-0 flex-col justify-center leading-none">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-neon-amber">
                        {t('profile.title')}
                    </span>
                    <span className="mt-1.5 font-mono text-[11px] text-white/50">
                        {formatMeters(summary.length)} · {summary.segmentCount}{' '}
                        {t('profile.segments')} · {summary.acceptedPointCount.toLocaleString()}{' '}
                        {t('profile.points')}
                        {summary.acceptedPointCount > summary.sampledPointCount && (
                            <>
                                {' '}
                                · {summary.sampledPointCount.toLocaleString()} {t('profile.shown')}
                            </>
                        )}
                    </span>
                </div>

                <div className="ml-auto flex items-center gap-1.5">
                    {!collapsed && (
                        <>
                            {phase === 'drawing' && (
                                <button
                                    type="button"
                                    onClick={onFinish}
                                    disabled={segments.length === 0}
                                    className="rounded border border-neon-amber/40 bg-neon-amber/10 px-2.5 py-1 text-xs text-neon-amber disabled:opacity-35"
                                >
                                    {t('profile.finish')}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={onDeleteLast}
                                className="rounded border border-white/10 px-2.5 py-1 text-xs text-white/65 hover:text-white"
                            >
                                {t('measurement.deleteLast')}
                            </button>
                            <button
                                type="button"
                                onClick={onNewProfile}
                                className="rounded border border-white/10 px-2.5 py-1 text-xs text-white/65 hover:text-white"
                            >
                                {t('profile.new')}
                            </button>
                            <button
                                type="button"
                                onClick={onExport}
                                disabled={bins.length === 0}
                                className="rounded border border-white/10 px-2.5 py-1 text-xs text-white/65 hover:text-white disabled:opacity-35"
                            >
                                {t('measurement.exportCsv')}
                            </button>
                            <label
                                className="ml-2 flex items-center gap-2 border-l border-white/10 pl-3 text-[11px] text-white/55"
                                title={t('profile.widthHint')}
                            >
                                {t('profile.width')}
                                <input
                                    type="range"
                                    min="0.25"
                                    max="10"
                                    step="0.25"
                                    value={widthInput}
                                    onChange={(event) => {
                                        const nextWidth = Number(event.currentTarget.value);
                                        setWidthInput(nextWidth);
                                        if (widthTimeoutRef.current) {
                                            clearTimeout(widthTimeoutRef.current);
                                        }
                                        widthTimeoutRef.current = setTimeout(() => {
                                            onWidthChangeRef.current(nextWidth);
                                        }, 250);
                                    }}
                                    className="w-24 accent-neon-amber"
                                />
                                <span className="w-10 font-mono text-white/75">
                                    {widthInput.toFixed(2)}m
                                </span>
                            </label>
                        </>
                    )}
                    <button
                        type="button"
                        onClick={() =>
                            setCollapsed((value) => {
                                onCollapsedChange(!value);
                                return !value;
                            })
                        }
                        className="flex h-7 w-7 items-center justify-center text-white/55 hover:text-white"
                        aria-label={collapsed ? t('profile.expand') : t('profile.collapse')}
                    >
                        <Icon name={collapsed ? 'chevronUp' : 'chevronDown'} size={16} />
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-7 w-7 items-center justify-center text-white/55 hover:text-plasma-red"
                        aria-label={t('profile.close')}
                    >
                        <Icon name="close" size={16} />
                    </button>
                </div>
            </header>

            {!collapsed && (
                <div ref={containerRef} className="relative h-[calc(100%-2.75rem)] overflow-hidden">
                    <canvas ref={dataCanvasRef} className="absolute inset-0" />
                    <canvas
                        ref={overlayCanvasRef}
                        className="absolute inset-0 cursor-crosshair touch-none"
                        onDoubleClick={resetView}
                        onPointerDown={(event) => {
                            event.currentTarget.setPointerCapture(event.pointerId);
                            dragRef.current = {
                                x: event.clientX,
                                y: event.clientY,
                                bounds: { ...viewRef.current },
                            };
                        }}
                        onPointerMove={handlePointerMove}
                        onPointerUp={(event) => {
                            event.currentTarget.releasePointerCapture(event.pointerId);
                            dragRef.current = null;
                        }}
                        onPointerLeave={() => {
                            if (!dragRef.current) clearSelection();
                        }}
                    />
                    <div
                        ref={tooltipRef}
                        hidden
                        className="pointer-events-none absolute left-0 top-0 min-w-56 rounded border border-neon-amber/35 bg-black/95 px-3 py-2 font-mono text-xs leading-5 text-white/90 shadow-lg"
                    >
                        <div className="grid grid-cols-[18px_1fr_auto] gap-x-2">
                            <span className="font-semibold text-neon-amber">X</span>
                            <span className="text-white/55">{t('profile.distance')}</span>
                            <span ref={tooltipDistanceRef} className="text-right text-white" />
                            <span className="font-semibold text-neon-amber">Y</span>
                            <span className="text-white/55">{t('profile.elevation')}</span>
                            <span ref={tooltipElevationRef} className="text-right text-white" />
                        </div>
                        <div
                            ref={tooltipDetailsRef}
                            className="mt-1 border-t border-white/10 pt-1 text-[11px] text-white/50"
                        />
                    </div>

                    {status === 'waiting' && (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-white/45">
                            {t('profile.drawHelp')}
                        </div>
                    )}
                    {status === 'loading' && sample.count === 0 && (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-white/45">
                            {t('profile.loading')}
                        </div>
                    )}
                    {status === 'empty' && (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-white/45">
                            {t('profile.empty')}
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}
