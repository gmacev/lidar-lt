import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/common/components';
import { useKeyboardCameraNavigation, usePotree } from '@/features/Viewer/hooks';
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
import { isMobile } from '@/common/utils/screenSize';
import { MarkerOverlay } from './MarkerOverlay';
import { ViewerLabelsOverlay } from './ViewerLabelsOverlay';
import { MeasurementContextMenus } from './MeasurementContextMenus';
import { ViewerCornerInfo } from './ViewerCornerInfo';
import { ViewerHud } from './ViewerHud';
import { ViewerLoadOverlay } from './ViewerLoadOverlay';
import { ViewerProfilePanel } from './ViewerProfilePanel';
import { OrthophotoCompareOverlay } from './OrthophotoCompareOverlay';

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
    const [projection, setProjection] = useState<Projection>(
        initialState.projection ?? 'PERSPECTIVE'
    );
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

    const handleOrthophotoCompareChange = (enabled: boolean) => {
        if (enabled) {
            const didSetProjection = setViewerProjection(viewerRef.current, 'ORTHOGRAPHIC');
            if (projection !== 'ORTHOGRAPHIC' && didSetProjection) {
                toast.info(t('orthophotoCompare.projectionChanged'), {
                    dedupeKey: 'orthophoto-compare-projection',
                });
            }
        } else {
            setViewerProjection(viewerRef.current, projection);
        }

        urlState.updateUrl({ orthophotoCompare: enabled ? true : undefined });
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
            className="potree-viewer relative h-dvh w-screen bg-void-black"
        >
            <div
                ref={containerRef}
                data-testid="viewer-container"
                className={`h-full w-full ${
                    tools.cursor.isAnnotationPlacing ? '!cursor-pointer' : ''
                } ${tools.cursor.isKvrInspecting ? '!cursor-help' : ''}`}
            />
            {orthophotoCompareEnabled && !isLoading && !error && (
                <OrthophotoCompareOverlay
                    key={cellId}
                    coverageBounds={sourceManifestState.coverageBounds}
                    coverageReady={sourceManifestState.settled}
                    isViewerReady
                    onError={handleOrthophotoError}
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
                onOrthophotoCompareChange={handleOrthophotoCompareChange}
                navigation={navigation}
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
