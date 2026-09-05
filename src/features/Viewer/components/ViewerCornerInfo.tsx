import { useEffect, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { PotreeViewer } from '@/common/types/potree';
import type { SourceManifest } from '@/features/Viewer/hooks/useSourceManifest';
import { SourceAttribution } from './SourceAttribution';
import { ViewerMapStatus } from './ViewerMapStatus';

interface ViewerCornerInfoProps {
    manifest: SourceManifest | null;
    viewerRef: RefObject<PotreeViewer | null>;
    uiVisible: boolean;
    mapLabelsEnabled: boolean;
    orthophotoCompareEnabled: boolean;
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
    manifest,
    viewerRef,
    uiVisible,
    mapLabelsEnabled,
    orthophotoCompareEnabled,
    className = '',
    onVisibleChange,
}: ViewerCornerInfoProps) {
    const { t } = useTranslation();
    const dateRange = formatDateRange(manifest?.sourceFileDateRange);
    const showSourceDetails = (uiVisible || orthophotoCompareEnabled) && Boolean(dateRange);
    const isVisible = showSourceDetails || mapLabelsEnabled;

    useEffect(() => {
        onVisibleChange?.(isVisible);
    }, [isVisible, onVisibleChange]);

    if (!isVisible) return null;

    return (
        <div
            className={`theme-surface theme-corner-info flex max-w-[calc(100vw-1rem)] items-center gap-x-2 gap-y-1 overflow-hidden rounded-tl-sm border border-b-0 border-r-0 border-white/10 bg-void-black/65 px-1 py-0.5 text-[10px] font-medium leading-none text-white/70 ${className}`}
        >
            {showSourceDetails && (
                // Scale bar, coordinates and LiDAR source are desktop-only:
                // hidden on small screens to avoid crowding the bottom bar.
                <span className="hidden items-center gap-x-2 sm:contents">
                    <ViewerMapStatus viewerRef={viewerRef} />
                    <span aria-hidden="true" className="text-white/35">
                        {'\u00b7'}
                    </span>
                    <SourceAttribution dateRange={dateRange!} />
                </span>
            )}
            {showSourceDetails && mapLabelsEnabled && (
                <span aria-hidden="true" className="hidden text-white/35 sm:inline">
                    {'\u00b7'}
                </span>
            )}
            {mapLabelsEnabled && (
                <span
                    data-testid="viewer-map-attribution"
                    className="inline-flex min-w-0 items-center gap-1 overflow-hidden text-ellipsis whitespace-nowrap"
                >
                    <a
                        href="https://openfreemap.org/"
                        target="_blank"
                        rel="noreferrer"
                        className="theme-corner-link text-white/75 underline-offset-2 hover:text-white hover:underline"
                    >
                        OpenFreeMap
                    </a>
                    <span>{'\u00a9'}</span>
                    <a
                        href="https://openmaptiles.org/"
                        target="_blank"
                        rel="noreferrer"
                        className="theme-corner-link text-white/75 underline-offset-2 hover:text-white hover:underline"
                    >
                        OpenMapTiles
                    </a>
                    <span>{t('home.mapDataFrom')}</span>
                    <a
                        href="https://www.openstreetmap.org/copyright"
                        target="_blank"
                        rel="noreferrer"
                        className="theme-corner-link text-white/75 underline-offset-2 hover:text-white hover:underline"
                    >
                        OpenStreetMap
                    </a>
                </span>
            )}
        </div>
    );
}
