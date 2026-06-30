import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/common/components';
import { useKeyboardCameraNavigation, usePotree } from '@/features/Viewer/hooks';
import { useViewerDataOriginPreconnect } from '@/features/Viewer/hooks/useViewerDataOriginPreconnect';
import { useViewerUrlState } from '@/features/Viewer/hooks/useViewerUrlState';
import { useViewerNavigationActions } from '@/features/Viewer/hooks/useViewerNavigationActions';
import { useViewerTools } from '@/features/Viewer/hooks/useViewerTools';
import { useMapLabels } from '@/features/Viewer/hooks/useMapLabels';
import { useKvrViewerLabels } from '@/features/Viewer/hooks/useKvrViewerLabels';
import { useReliefAzimuthCycle } from '@/features/Viewer/hooks/useReliefAzimuthCycle';
import type { ViewerState } from '@/features/Viewer/config/viewerConfig';
import {
    getViewerDataUrl,
    getViewerSourceManifestUrl,
} from '@/features/Viewer/utils/viewerDataUrls';
import { isMobile } from '@/common/utils/screenSize';
import { MarkerOverlay } from './MarkerOverlay';
import { ViewerLabelsOverlay } from './ViewerLabelsOverlay';
import { MeasurementContextMenus } from './MeasurementContextMenus';
import { ViewerCornerInfo } from './ViewerCornerInfo';
import { ViewerHud } from './ViewerHud';
import { ViewerLoadOverlay } from './ViewerLoadOverlay';
import { ViewerProfilePanel } from './ViewerProfilePanel';

interface ViewerPageProps {
    cellId: string;
    onBack: () => void;
    initialState: ViewerState;
}

export function ViewerPage({ cellId, onBack, initialState }: ViewerPageProps) {
    const { t, i18n } = useTranslation();
    const dataUrl = getViewerDataUrl(cellId);
    const sourceManifestUrl = getViewerSourceManifestUrl(cellId);
    const [uiVisible, setUiVisible] = useState(true);
    const [isSourceAttributionVisible, setIsSourceAttributionVisible] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(isMobile);
    const urlState = useViewerUrlState({ cellId, initialState });
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

    return (
        <div data-testid="viewer-page" className="relative h-dvh w-screen bg-void-black">
            <div
                ref={containerRef}
                data-testid="viewer-container"
                className={`h-full w-full ${
                    tools.cursor.isAnnotationPlacing ? '!cursor-pointer' : ''
                } ${tools.cursor.isKvrInspecting ? '!cursor-help' : ''}`}
            />
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
                    manifestUrl={sourceManifestUrl}
                    viewerRef={viewerRef}
                    uiVisible={uiVisible}
                    mapLabelsEnabled={mapLabelsEnabled}
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
                navigation={navigation}
                onBack={onBack}
                onSidebarCollapsedChange={setIsSidebarCollapsed}
                onUiVisibleChange={setUiVisible}
                orientNorth={orientNorth}
                profile={tools.profile}
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
