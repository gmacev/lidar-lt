import type { RefObject } from 'react';
import type { PotreeViewer } from '@/common/types/potree';
import { useProjectedViewerLabels } from '@/features/Viewer/hooks/useProjectedViewerLabels';
import {
    getViewerLabelEmphasis,
    getViewerLabelKey,
    VIEWER_LABEL_METRICS,
    type ViewerLabel,
    type ViewerLabelEmphasis,
    type ViewerLabelTone,
} from '@/features/Viewer/utils/viewerLabels';

interface ViewerLabelsOverlayProps {
    labels: ViewerLabel[];
    viewerRef: RefObject<PotreeViewer | null>;
}

const toneClasses: Record<ViewerLabelTone, string> = {
    neutral: 'text-white/90',
    water: 'italic text-[#8fc8ef]',
    accent: 'border border-neon-amber/45 !bg-black/60 text-neon-amber hover:border-neon-amber focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-amber/70',
};

const emphasisClasses: Record<ViewerLabelEmphasis, string> = {
    primary:
        'max-w-56 bg-black/60 px-2 py-1 text-[14px] font-bold leading-[14px] tracking-[0.005em] shadow-[0_1px_4px_rgba(0,0,0,0.95)] [text-shadow:0_1px_2px_#000,0_0_4px_#000]',
    secondary:
        'max-w-48 bg-black/50 px-1.5 py-0.5 text-[12px] font-semibold leading-none tracking-[0.01em] shadow-[0_1px_3px_rgba(0,0,0,0.9)] [text-shadow:0_1px_2px_#000,0_0_3px_#000]',
    tertiary:
        'max-w-44 bg-black/40 px-1.5 py-0.5 text-[11px] font-medium leading-[11px] tracking-[0.01em] shadow-[0_1px_2px_rgba(0,0,0,0.85)] [text-shadow:0_1px_2px_#000,0_0_2px_#000]',
};

export function ViewerLabelsOverlay({ labels, viewerRef }: ViewerLabelsOverlayProps) {
    const projectedLabels = useProjectedViewerLabels({ labels, viewerRef });
    const labelsByKey = new Map(labels.map((label) => [getViewerLabelKey(label), label]));
    const labelsBySource = new Map<string, Array<{ label: ViewerLabel; x: number; y: number }>>();

    projectedLabels.forEach((projected) => {
        const label = labelsByKey.get(projected.key);
        if (!label) return;
        const sourceLabels = labelsBySource.get(label.source) ?? [];
        sourceLabels.push({ label, x: projected.screenX, y: projected.screenY });
        labelsBySource.set(label.source, sourceLabels);
    });

    if (projectedLabels.length === 0) return null;

    return (
        <div
            data-testid="viewer-labels"
            className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
        >
            {[...labelsBySource.entries()].map(([source, sourceLabels]) => (
                <div
                    key={source}
                    data-testid={`viewer-${source}-labels`}
                    className="contents"
                    aria-hidden={sourceLabels.every(({ label }) => !label.onActivate) || undefined}
                >
                    {sourceLabels.map(({ label, x, y }) => {
                        const tone = label.tone ?? 'neutral';
                        const emphasis = getViewerLabelEmphasis(label);
                        const metrics = VIEWER_LABEL_METRICS[emphasis];
                        const className = `absolute rounded-sm ${emphasisClasses[emphasis]} ${toneClasses[tone]}`;
                        const expandableClassName = `pointer-events-auto overflow-hidden text-ellipsis whitespace-nowrap text-left hover:z-20 hover:overflow-visible hover:whitespace-normal hover:text-clip ${className}`;
                        const expandableStyle = {
                            left: x,
                            top: y,
                            // Keep the single-line top edge fixed so wrapped text grows downward.
                            transform: `translate(-50%, -${metrics.anchorOffset}px)`,
                        };
                        if (label.onActivate) {
                            return (
                                <button
                                    key={label.id}
                                    type="button"
                                    data-viewer-label-id={label.id}
                                    data-viewer-label-source={label.source}
                                    aria-label={label.ariaLabel ?? label.text}
                                    className={`${expandableClassName} focus-visible:z-20 focus-visible:overflow-visible focus-visible:whitespace-normal focus-visible:text-clip`}
                                    style={expandableStyle}
                                    onPointerDown={(event) => event.stopPropagation()}
                                    onClick={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        label.onActivate?.();
                                    }}
                                >
                                    {label.text}
                                </button>
                            );
                        }

                        return (
                            <span
                                key={label.id}
                                data-viewer-label-id={label.id}
                                data-viewer-label-source={label.source}
                                className={expandableClassName}
                                style={expandableStyle}
                            >
                                {label.text}
                            </span>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}
