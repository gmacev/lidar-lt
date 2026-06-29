import type { RefObject } from 'react';
import type { PotreeViewer } from '@/common/types/potree';
import { useProjectedViewerLabels } from '@/features/Viewer/hooks/useProjectedViewerLabels';
import {
    getViewerLabelKey,
    type ViewerLabel,
    type ViewerLabelTone,
} from '@/features/Viewer/utils/viewerLabels';

interface ViewerLabelsOverlayProps {
    labels: ViewerLabel[];
    viewerRef: RefObject<PotreeViewer | null>;
}

const toneClasses: Record<ViewerLabelTone, string> = {
    neutral: 'bg-black/45 font-semibold text-white/90',
    water: 'bg-black/45 font-medium italic text-[#8fc8ef]',
    accent: 'border border-neon-amber/45 bg-black/70 font-semibold text-neon-amber hover:border-neon-amber hover:bg-neon-amber/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-amber/70',
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
                        const className = `absolute max-w-48 -translate-x-1/2 -translate-y-1/2 truncate whitespace-nowrap rounded-sm px-1.5 py-0.5 text-[12px] leading-none tracking-[0.01em] shadow-[0_1px_3px_rgba(0,0,0,0.9)] [text-shadow:0_1px_2px_#000,0_0_3px_#000] ${toneClasses[tone]}`;
                        const style = { left: x, top: y };

                        if (label.onActivate) {
                            return (
                                <button
                                    key={label.id}
                                    type="button"
                                    data-viewer-label-id={label.id}
                                    data-viewer-label-source={label.source}
                                    aria-label={label.ariaLabel ?? label.text}
                                    className={`pointer-events-auto ${className}`}
                                    style={style}
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
                                className={className}
                                style={style}
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
