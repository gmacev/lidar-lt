import { useEffect, useState, type RefObject } from 'react';
import type { PotreeViewer } from '@/common/types/potree';
import { SourceAttribution } from './SourceAttribution';
import { ViewerMapStatus } from './ViewerMapStatus';

interface SourceManifest {
    sourceFileDateRange?: {
        from?: string | null;
        to?: string | null;
    };
}

interface ViewerCornerInfoProps {
    manifestUrl: string;
    viewerRef: RefObject<PotreeViewer | null>;
    uiVisible: boolean;
    mapLabelsEnabled: boolean;
    className?: string;
    onVisibleChange?: (visible: boolean) => void;
}

function formatDateRange(range: SourceManifest['sourceFileDateRange']) {
    const from = range?.from;
    const to = range?.to;

    if (!from && !to) return null;
    if (!from) return to ?? null;
    if (!to || from === to) return from;

    return `${from} - ${to}`;
}

export function ViewerCornerInfo({
    manifestUrl,
    viewerRef,
    uiVisible,
    mapLabelsEnabled,
    className = '',
    onVisibleChange,
}: ViewerCornerInfoProps) {
    const [dateRange, setDateRange] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();

        void fetch(manifestUrl, { signal: controller.signal })
            .then((response) => (response.ok ? response.json() : null))
            .then((data: SourceManifest | null) => {
                const nextDateRange = formatDateRange(data?.sourceFileDateRange);

                setDateRange(nextDateRange);
                onVisibleChange?.(Boolean(nextDateRange) || mapLabelsEnabled);
            })
            .catch((error: unknown) => {
                if (error instanceof DOMException && error.name === 'AbortError') return;
                setDateRange(null);
                onVisibleChange?.(mapLabelsEnabled);
            });

        return () => controller.abort();
    }, [manifestUrl, mapLabelsEnabled, onVisibleChange]);

    const showSourceDetails = uiVisible && Boolean(dateRange);
    if (!showSourceDetails && !mapLabelsEnabled) return null;

    return (
        <div
            className={`flex max-w-[calc(100vw-1rem)] flex-wrap items-center gap-x-2 gap-y-1 rounded-tl-sm border border-b-0 border-r-0 border-white/10 bg-black/65 px-1 py-0.5 text-[10px] font-medium leading-none text-white/70 ${className}`}
        >
            {showSourceDetails && (
                <>
                    <ViewerMapStatus viewerRef={viewerRef} />
                    <span aria-hidden="true" className="text-white/35">
                        {'\u00b7'}
                    </span>
                    <SourceAttribution dateRange={dateRange!} />
                </>
            )}
            {showSourceDetails && mapLabelsEnabled && (
                <span aria-hidden="true" className="text-white/35">
                    {'\u00b7'}
                </span>
            )}
            {mapLabelsEnabled && (
                <span className="inline-flex items-center gap-1 whitespace-nowrap">
                    <a
                        href="https://openfreemap.org/"
                        target="_blank"
                        rel="noreferrer"
                        className="text-white/75 underline-offset-2 hover:text-white hover:underline"
                    >
                        OpenFreeMap
                    </a>
                    <a
                        href="https://openmaptiles.org/"
                        target="_blank"
                        rel="noreferrer"
                        className="text-white/75 underline-offset-2 hover:text-white hover:underline"
                    >
                        © OpenMapTiles
                    </a>
                    <span>{'·'}</span>
                    <a
                        href="https://www.openstreetmap.org/copyright"
                        target="_blank"
                        rel="noreferrer"
                        className="text-white/75 underline-offset-2 hover:text-white hover:underline"
                    >
                        © OpenStreetMap contributors
                    </a>
                </span>
            )}
        </div>
    );
}
