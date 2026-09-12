import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/common/components';
import { useKeyboardCameraNavigation, usePotree } from '@/features/Viewer/hooks';
import { useOrthophotoCatalog } from '@/features/Viewer/hooks/useOrthophotoCatalog';
import { findOrthophotoService } from '@/features/Viewer/utils/orthophotoCatalog';
import { useViewerDataOriginPreconnect } from '@/features/Viewer/hooks/useViewerDataOriginPreconnect';
import { useViewerUrlState } from '@/features/Viewer/hooks/useViewerUrlState';
import { useViewerNavigationActions } from '@/features/Viewer/hooks/useViewerNavigationActions';
import { useViewerTools } from '@/features/Viewer/hooks/useViewerTools';
import { useMapLabels } from '@/features/Viewer/hooks/useMapLabels';
import { useSourceManifest } from '@/features/Viewer/hooks/useSourceManifest';
import { useKvrViewerLabels } from '@/features/Viewer/hooks/useKvrViewerLabels';
import { useReliefAzimuthCycle } from '@/features/Viewer/hooks/useReliefAzimuthCycle';
import type { Projection, ViewerState } from '@/features/Viewer/config/viewerConfig';
import {
    getViewerDataUrl,
    getViewerSourceManifestUrl,
} from '@/features/Viewer/utils/viewerDataUrls';
import { setViewerProjection } from '@/features/Viewer/utils/viewerDefaults';
import { isFirefoxAndroid, isMobile } from '@/common/utils/screenSize';
import { MarkerOverlay } from './MarkerOverlay';
import { ViewerLabelsOverlay } from './ViewerLabelsOverlay';
import { MeasurementContextMenus } from './MeasurementContextMenus';
import { ViewerCornerInfo } from './ViewerCornerInfo';
import { ViewerHud } from './ViewerHud';
import { ViewerLoadOverlay } from './ViewerLoadOverlay';
import { ViewerProfilePanel } from './ViewerProfilePanel';
import { OrthophotoCompareOverlay } from './OrthophotoCompareOverlay';
import { OrthophotoYearPicker } from './OrthophotoYearPicker';

interface ViewerPageProps {
    cellId: string;
    onBack: () => void;
    initialState: ViewerState;
}

export function ViewerPage({ cellId, onBack, initialState }: ViewerPageProps) {
    const { t, i18n } = useTranslation();
    const dataUrl = getViewerDataUrl(cellId);
    const sourceManifestUrl = getViewerSourceManifestUrl(cellId);
    const sourceManifestState = useSourceManifest(sourceManifestUrl);
    const [uiVisible, setUiVisible] = useState(true);
    const [isSourceAttributionVisible, setIsSourceAttributionVisible] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(isMobile);
    const urlState = useViewerUrlState({ cellId, initialState });
    const orthophotoCompareEnabled = initialState.orthophotoCompare === true;
    const [isOrthophotoPickerOpen, setIsOrthophotoPickerOpen] = useState(false);
    const orthophotoButtonRef = useRef<HTMLButtonElement | null>(null);
    const orthophotoPickerRef = useRef<HTMLDivElement | null>(null);
    const orthophotoErrorReportedRef = useRef<string | null>(null);
    const recentFailedRef = useRef(false);
    const [projection, setProjection] = useState<Projection>(
        initialState.projection ?? 'PERSPECTIVE'
    );
    const needsFirefoxViewportInset = isFirefoxAndroid();
    const effectiveProjection: Projection = orthophotoCompareEnabled ? 'ORTHOGRAPHIC' : projection;
    useViewerDataOriginPreconnect();

    const {
        containerRef,
        viewerRef,
        markCameraInteraction,
        orientNorth,
        recenterView,
        isLoading,
        error,
    } = usePotree({
        dataUrl,
        initialState,
        updateUrl: urlState.updateUrlDebounced,
    });
    useEffect(() => {
        if (isLoading || error) return;
        setViewerProjection(viewerRef.current, effectiveProjection);
    }, [effectiveProjection, error, isLoading, viewerRef]);
    useKeyboardCameraNavigation({
        viewerRef,
        enabled: !isLoading && !error,
        onInteraction: markCameraInteraction,
    });
    const reliefAzimuthCycle = useReliefAzimuthCycle({
        initialState: urlState.sidebarInitialState,
        resetKey: `${cellId}:${urlState.sidebarResetKey}`,
        updateUrl: urlState.updateUrl,
        viewerRef,
    });
    const navigation = useViewerNavigationActions({
        cellId,
        initialState,
        viewerRef,
        recenterView,
        cancelPendingUrlUpdate: () => urlState.updateUrlDebounced.cancel(),
        updateUrl: urlState.updateUrl,
        setSidebarInitialState: urlState.setSidebarInitialState,
        bumpSidebarResetKey: urlState.bumpSidebarResetKey,
    });
    const tools = useViewerTools({
        viewerRef,
        cellId,
        dataUrl,
        markerParam: initialState.mk,
        onMarkerSearchChange: urlState.updateUrl,
    });
    const sectorLabel = initialState.sectorName ?? cellId;
    const mapLabelsEnabled = initialState.mapLabels === true;
    const mapLabelState = useMapLabels({
        coverageBounds: sourceManifestState.coverageBounds,
        coverageReady: sourceManifestState.settled,
        enabled: mapLabelsEnabled,
        language: i18n.resolvedLanguage ?? i18n.language,
        sectorId: cellId,
        viewerRef,
    });
    const kvrLabels = useKvrViewerLabels({
        enabled:
            uiVisible && tools.kvr.isPopoverOpen && tools.kvr.inspectState.status === 'success',
        matches: tools.kvr.inspectState.matches,
        unnamedLabel: t('kvrInspect.unnamed'),
        onCenterMatch: navigation.handleCenterKvrMatch,
        onFocusMatch: tools.kvr.onFocusMatch,
    });
    const viewerLabels = [...mapLabelState.labels, ...kvrLabels];

    useEffect(() => {
        if (!mapLabelState.error) return;
        toast.error(t('mapLabels.errorTitle'), {
            description: t('mapLabels.errorDescription'),
            dedupeKey: `map-labels-${cellId}`,
        });
    }, [cellId, mapLabelState.error, t]);

    const handleOrthophotoError = () => {
        toast.error(t('orthophotoCompare.errorTitle'), {
            description: t('orthophotoCompare.errorDescription'),
            dedupeKey: `orthophoto-compare-${cellId}`,
        });
    };

    const orthophotoCatalog = useOrthophotoCatalog({
        cellId,
        coverageBounds: sourceManifestState.coverageBounds,
        coverageReady: sourceManifestState.settled,
        enabled: orthophotoCompareEnabled,
        viewerRef,
    });
    const { datedReady, recentReady } = orthophotoCatalog;
    const resolvedOrthophotoService = orthophotoCompareEnabled
        ? findOrthophotoService(orthophotoCatalog.services, initialState.orthoYear)
        : null;
    // An explicit choice that resolves to nothing stays unresolved while
    // either source is still loading, instead of flashing the wrong vintage.
    // The default is the continuous mosaic, so it waits for recent rather
    // than flashing a dated vintage that won the discovery race.
    let selectedOrthophotoService = resolvedOrthophotoService;
    if (selectedOrthophotoService) {
        if (initialState.orthoYear === undefined) {
            if (!recentReady) selectedOrthophotoService = null;
        } else if (
            selectedOrthophotoService.id !== initialState.orthoYear &&
            (!datedReady || !recentReady)
        ) {
            selectedOrthophotoService = null;
        }
    }

    // Pin the resolved vintage so reloads and shared links keep the same imagery.
    useEffect(() => {
        if (!orthophotoCompareEnabled || orthophotoCatalog.status !== 'ready') return;
        if (orthophotoCatalog.services.length === 0) return;
        const resolved = findOrthophotoService(orthophotoCatalog.services, initialState.orthoYear);
        if (resolved && resolved.id !== initialState.orthoYear) {
            // Never clobber an explicit choice before both sources arrive.
            if (initialState.orthoYear !== undefined && (!datedReady || !recentReady)) return;
            // Never churn the default pin while recent is still pending.
            if (initialState.orthoYear === undefined && !recentReady) return;
            urlState.updateUrl({ orthoYear: resolved.id });
        }
    }, [
        datedReady,
        initialState.orthoYear,
        orthophotoCatalog.services,
        orthophotoCatalog.status,
        orthophotoCompareEnabled,
        recentReady,
        urlState,
    ]);

    // Surface catalog failure or empty coverage with the non-blocking toast, once per sector.
    useEffect(() => {
        if (!orthophotoCompareEnabled) return;
        const failed =
            orthophotoCatalog.status === 'error' ||
            (orthophotoCatalog.status === 'ready' && orthophotoCatalog.services.length === 0);
        if (!failed || orthophotoErrorReportedRef.current === cellId) return;
        orthophotoErrorReportedRef.current = cellId;
        handleOrthophotoError();
    }, [cellId, orthophotoCatalog.status, orthophotoCompareEnabled]);

    useEffect(() => {
        recentFailedRef.current = false;
    }, [cellId]);

    // When every visible tile of the continuous mosaic fails, yield once to
    // the first dated service instead of leaving a broken layer up.
    useEffect(() => {
        if (!orthophotoCompareEnabled || !recentFailedRef.current) return;
        if (selectedOrthophotoService?.kind !== 'recent') {
            recentFailedRef.current = false;
            return;
        }
        if (!datedReady) return;
        recentFailedRef.current = false;
        const fallback = orthophotoCatalog.services.find((service) => service.kind === 'dated');
        if (fallback) {
            urlState.updateUrl({ orthoYear: fallback.id });
        } else {
            handleOrthophotoError();
        }
    }, [
        datedReady,
        orthophotoCatalog.services,
        orthophotoCompareEnabled,
        selectedOrthophotoService,
        urlState,
    ]);

    const handleOrthophotoTilesFailed = () => {
        if (selectedOrthophotoService?.kind === 'recent') {
            const fallback = orthophotoCatalog.services.find((service) => service.kind === 'dated');
            if (fallback) {
                urlState.updateUrl({ orthoYear: fallback.id });
                return;
            }
            if (datedReady) {
                handleOrthophotoError();
                return;
            }
            // Dated options are still loading; the effect above retries the
            // fallback once they arrive.
            recentFailedRef.current = true;
            return;
        }
        handleOrthophotoError();
    };

    useEffect(() => {
        if (!isOrthophotoPickerOpen) return;

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) return;
            if (orthophotoButtonRef.current?.contains(target)) return;
            if (orthophotoPickerRef.current?.contains(target)) return;
            setIsOrthophotoPickerOpen(false);
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setIsOrthophotoPickerOpen(false);
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOrthophotoPickerOpen]);

    const handleOrthophotoToolClick = () => {
        if (!orthophotoCompareEnabled) {
            const didSetProjection = setViewerProjection(viewerRef.current, 'ORTHOGRAPHIC');
            if (projection !== 'ORTHOGRAPHIC' && didSetProjection) {
                toast.info(t('orthophotoCompare.projectionChanged'), {
                    dedupeKey: 'orthophoto-compare-projection',
                });
            }
            urlState.updateUrl({ orthophotoCompare: true });
            setIsOrthophotoPickerOpen(true);
            return;
        }
        setIsOrthophotoPickerOpen((current) => !current);
    };

    const handleOrthophotoYearSelect = (id: string) => {
        urlState.updateUrl({ orthoYear: id });
    };

    const handleOrthophotoDisable = () => {
        setViewerProjection(viewerRef.current, projection);
        setIsOrthophotoPickerOpen(false);
        recentFailedRef.current = false;
        urlState.updateUrl({ orthophotoCompare: undefined, orthoYear: undefined });
    };

    const handleSectorNavigate: typeof navigation.handleSectorNavigate = (sector) => {
        setIsOrthophotoPickerOpen(false);
        navigation.handleSectorNavigate(sector);
    };

    const handleProjectionChange = (nextProjection: Projection) => {
        setProjection(nextProjection);
        urlState.updateUrl({
            projection: nextProjection === 'ORTHOGRAPHIC' ? nextProjection : undefined,
        });
    };

    return (
        <div
            data-testid="viewer-page"
            className={`potree-viewer fixed inset-0 h-svh w-svw touch-none overflow-hidden bg-void-black ${
                needsFirefoxViewportInset ? 'viewer-firefox-android-viewport' : ''
            }`}
        >
            <div
                ref={containerRef}
                data-testid="viewer-container"
                className={`h-full w-full ${
                    tools.cursor.isAnnotationPlacing ? '!cursor-pointer' : ''
                } ${tools.cursor.isKvrInspecting ? '!cursor-help' : ''}`}
            />
            {orthophotoCompareEnabled && selectedOrthophotoService && !isLoading && !error && (
                <OrthophotoCompareOverlay
                    key={`${cellId}:${selectedOrthophotoService.id}`}
                    coverageBounds={sourceManifestState.coverageBounds}
                    coverageReady={sourceManifestState.settled}
                    isViewerReady
                    onError={handleOrthophotoTilesFailed}
                    service={selectedOrthophotoService}
                    viewerRef={viewerRef}
                />
            )}
            <ViewerLabelsOverlay labels={viewerLabels} viewerRef={viewerRef} />
            <MarkerOverlay markers={tools.markers.markers} onDelete={tools.markers.deleteMarker} />

            <ViewerLoadOverlay
                isLoading={isLoading}
                error={error}
                sectorLabel={sectorLabel}
                onBack={onBack}
            />

            {!isLoading && !error && (
                <ViewerCornerInfo
                    manifest={sourceManifestState.manifest}
                    viewerRef={viewerRef}
                    uiVisible={uiVisible}
                    mapLabelsEnabled={mapLabelsEnabled}
                    orthophotoCompareEnabled={orthophotoCompareEnabled}
                    className="absolute bottom-0 right-0 z-10"
                    onVisibleChange={setIsSourceAttributionVisible}
                />
            )}

            <ViewerHud
                cellId={cellId}
                hasError={!!error}
                initialState={initialState}
                isLoading={isLoading}
                isSourceAttributionVisible={isSourceAttributionVisible}
                kvr={tools.kvr}
                markers={tools.markers}
                mapLabelsEnabled={mapLabelsEnabled}
                orthophotoCompareEnabled={orthophotoCompareEnabled}
                orthophotoButtonRef={orthophotoButtonRef}
                onOrthophotoToolClick={handleOrthophotoToolClick}
                navigation={{ ...navigation, handleSectorNavigate }}
                onBack={onBack}
                onSidebarCollapsedChange={setIsSidebarCollapsed}
                onUiVisibleChange={setUiVisible}
                orientNorth={orientNorth}
                profile={tools.profile}
                projection={effectiveProjection}
                projectionLocked={orthophotoCompareEnabled}
                onProjectionChange={handleProjectionChange}
                reliefAzimuthCycle={reliefAzimuthCycle}
                sidebarInitialState={urlState.sidebarInitialState}
                sidebarResetKey={urlState.sidebarResetKey}
                toolbar={tools.toolbar}
                uiVisible={uiVisible}
                updateUrl={urlState.updateUrl}
                viewerRef={viewerRef}
            />

            {uiVisible && <MeasurementContextMenus menus={tools.contextMenus} />}

            <OrthophotoYearPicker
                anchorRef={orthophotoButtonRef}
                contentRef={orthophotoPickerRef}
                datedReady={orthophotoCatalog.datedReady}
                isOpen={isOrthophotoPickerOpen && orthophotoCompareEnabled && uiVisible}
                onClose={() => setIsOrthophotoPickerOpen(false)}
                onDisable={handleOrthophotoDisable}
                onRetry={orthophotoCatalog.retry}
                onSelect={handleOrthophotoYearSelect}
                selectedId={selectedOrthophotoService?.id ?? null}
                services={orthophotoCatalog.services}
                status={orthophotoCatalog.status}
            />

            <ViewerProfilePanel
                error={error}
                isLoading={isLoading}
                isSidebarCollapsed={isSidebarCollapsed}
                profile={tools.profile}
                uiVisible={uiVisible}
                viewerRef={viewerRef}
            />
        </div>
    );
}
