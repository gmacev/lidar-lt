import { useState } from 'react';
import { useKeyboardCameraNavigation, usePotree } from '@/features/Viewer/hooks';
import { useViewerDataOriginPreconnect } from '@/features/Viewer/hooks/useViewerDataOriginPreconnect';
import { useViewerUrlState } from '@/features/Viewer/hooks/useViewerUrlState';
import { useViewerNavigationActions } from '@/features/Viewer/hooks/useViewerNavigationActions';
import { useViewerTools } from '@/features/Viewer/hooks/useViewerTools';
import type { ViewerState } from '@/features/Viewer/config/viewerConfig';
import {
    getViewerDataUrl,
    getViewerSourceManifestUrl,
} from '@/features/Viewer/utils/viewerDataUrls';
import { isMobile } from '@/common/utils/screenSize';
import { MarkerOverlay } from './MarkerOverlay';
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

    return (
        <div data-testid="viewer-page" className="relative h-dvh w-screen bg-void-black">
            <div
                ref={containerRef}
                data-testid="viewer-container"
                className={`h-full w-full ${
                    tools.cursor.isAnnotationPlacing ? '!cursor-pointer' : ''
                } ${tools.cursor.isKvrInspecting ? '!cursor-help' : ''}`}
            />
            <MarkerOverlay markers={tools.markers.markers} onDelete={tools.markers.deleteMarker} />

            <ViewerLoadOverlay
                isLoading={isLoading}
                error={error}
                sectorLabel={sectorLabel}
                onBack={onBack}
            />

            {uiVisible && !isLoading && !error && (
                <ViewerCornerInfo
                    manifestUrl={sourceManifestUrl}
                    viewerRef={viewerRef}
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
                navigation={navigation}
                onBack={onBack}
                onSidebarCollapsedChange={setIsSidebarCollapsed}
                onUiVisibleChange={setUiVisible}
                orientNorth={orientNorth}
                profile={tools.profile}
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
