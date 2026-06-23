import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { PotreeViewer } from '@/common/types/potree';
import { GlassPanel, Icon, LanguageSwitcher } from '@/common/components';
import type { ViewerState } from '@/features/Viewer/config/viewerConfig';
import type { ViewerNavigationActions } from '@/features/Viewer/hooks/useViewerNavigationActions';
import type {
    ViewerKvrToolModel,
    ViewerMarkersModel,
    ViewerProfilePanelModel,
    ViewerToolbarTools,
} from '@/features/Viewer/hooks/useViewerTools';
import { MeasurementToolbar } from './MeasurementToolbar';
import { ViewerSidebar } from './ViewerSidebar';
import { Compass } from './Compass';
import { CoordinateSearchControl } from './CoordinateSearchControl';
import { GoogleMapsButton } from './GoogleMapsButton';
import { KvrInspectButton } from './KvrInspectButton';
import { SectorNavigation } from './SectorNavigation';
import { ToolbarToolButton } from './ToolbarToolButton';

interface ViewerHudProps {
    cellId: string;
    hasError: boolean;
    initialState: ViewerState;
    isLoading: boolean;
    isSourceAttributionVisible: boolean;
    kvr: ViewerKvrToolModel;
    markers: ViewerMarkersModel;
    navigation: ViewerNavigationActions;
    onBack: () => void;
    onSidebarCollapsedChange: (collapsed: boolean) => void;
    onUiVisibleChange: (visible: boolean) => void;
    orientNorth: () => void;
    profile: ViewerProfilePanelModel;
    sidebarInitialState: ViewerState;
    sidebarResetKey: number;
    toolbar: ViewerToolbarTools;
    uiVisible: boolean;
    updateUrl: (state: Partial<ViewerState>) => void;
    viewerRef: RefObject<PotreeViewer | null>;
}

export function ViewerHud({
    cellId,
    hasError,
    initialState,
    isLoading,
    isSourceAttributionVisible,
    kvr,
    markers,
    navigation,
    onBack,
    onSidebarCollapsedChange,
    onUiVisibleChange,
    orientNorth,
    profile,
    sidebarInitialState,
    sidebarResetKey,
    toolbar,
    uiVisible,
    updateUrl,
    viewerRef,
}: ViewerHudProps) {
    const { t } = useTranslation();

    return (
        <>
            {uiVisible && (
                <>
                    {/* Sector info + Coordinate Search - bottom center, always */}
                    {!isLoading && !hasError && !profile.isMeasuring && (
                        <div
                            className={`absolute left-1/2 z-20 flex -translate-x-1/2 items-stretch gap-2 ${
                                profile.isMeasuring
                                    ? profile.isPanelCollapsed
                                        ? 'bottom-[3.25rem]'
                                        : 'bottom-[calc(clamp(240px,34dvh,360px)+0.5rem)]'
                                    : 'bottom-2 xl:bottom-4'
                            }`}
                        >
                            <CoordinateSearchControl
                                viewerRef={viewerRef}
                                sectorName={initialState.sectorName}
                                cellId={cellId}
                                onAddMarkerAtViewCenter={markers.addMarkerAtViewCenter}
                            />
                            <SectorNavigation
                                cellId={cellId}
                                onNavigate={navigation.handleSectorNavigate}
                            />
                        </div>
                    )}

                    {/* Language switcher, UI toggle, and Controls - top right corner */}
                    <div className="absolute right-2 top-2 flex items-start gap-2 xl:right-4 xl:top-4">
                        <LanguageSwitcher />
                        {!isLoading && !hasError && (
                            <>
                                <button
                                    onClick={() => onUiVisibleChange(!uiVisible)}
                                    className="flex h-10 w-10 items-center justify-center rounded-lg border transition-all bg-glass-bg border-white/10 text-white/70 hover:text-neon-amber hover:border-neon-amber/50 hover:bg-black/95"
                                    title={
                                        uiVisible
                                            ? t('viewer.hideControls')
                                            : t('viewer.showControls')
                                    }
                                >
                                    <Icon name={uiVisible ? 'eyeOff' : 'eye'} size={20} />
                                </button>
                                {/* Controls panel - hidden on small screens */}
                                <GlassPanel className="hidden w-64 md:block">
                                    <h3 className="mb-2 text-sm font-bold text-neon-amber">
                                        {t('viewer.controls')}
                                    </h3>
                                    <ul className="space-y-1 text-xs text-white/70">
                                        <li>{t('viewer.controlLeftClick')}</li>
                                        <li>{t('viewer.controlRightClick')}</li>
                                        <li>{t('viewer.controlScroll')}</li>
                                        <li>{t('viewer.controlAddMarker')}</li>
                                    </ul>
                                </GlassPanel>
                            </>
                        )}
                    </div>

                    {/* Right rail - keeps measurement tools and navigation aids from colliding */}
                    {!isLoading && !hasError && (
                        <div
                            className={`absolute right-2 top-16 z-20 flex w-10 flex-col items-center gap-3 md:top-[140px] xl:right-4 ${
                                profile.isMeasuring
                                    ? profile.isPanelCollapsed
                                        ? 'bottom-[3.25rem]'
                                        : 'bottom-[calc(clamp(240px,34dvh,360px)+0.5rem)]'
                                    : isSourceAttributionVisible
                                      ? 'bottom-10'
                                      : 'bottom-2'
                            }`}
                        >
                            <MeasurementToolbar
                                className="min-h-0 w-max max-w-[280px] flex-1 self-end"
                                tools={toolbar}
                            />

                            <div className="flex shrink-0 flex-col items-center gap-2">
                                <ToolbarToolButton
                                    icon={<Icon name="crosshair" size={20} />}
                                    isActive={false}
                                    label={t('viewer.recenter')}
                                    onClick={navigation.handleRecenterView}
                                />
                                <GoogleMapsButton viewerRef={viewerRef} />
                                <KvrInspectButton
                                    inspectState={kvr.inspectState}
                                    isActive={kvr.isInspecting}
                                    isPopoverOpen={kvr.isPopoverOpen}
                                    onClick={kvr.onToggle}
                                    onClose={kvr.onClose}
                                    onCenterMatch={navigation.handleCenterKvrMatch}
                                    onRetry={kvr.onRetry}
                                />
                                <Compass viewerRef={viewerRef} onOrientNorth={orientNorth} />
                            </div>
                        </div>
                    )}

                    {/* Unified Sidebar - handles its own positioning */}
                    {!isLoading && !hasError && (
                        <ViewerSidebar
                            viewerRef={viewerRef}
                            initialState={sidebarInitialState}
                            currentState={sidebarInitialState}
                            updateUrl={updateUrl}
                            onBack={onBack}
                            onResetDefaults={navigation.handleResetDefaults}
                            onLoadPreset={navigation.handleLoadPreset}
                            onCollapsedChange={onSidebarCollapsedChange}
                            resetKey={sidebarResetKey}
                        />
                    )}
                </>
            )}

            {/* UI Toggle button - ALWAYS visible, top right next to language switcher */}
            {!uiVisible && !isLoading && !hasError && (
                <button
                    onClick={() => onUiVisibleChange(!uiVisible)}
                    className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-lg border transition-all z-20 bg-glass-bg border-white/10 text-white/70 hover:text-neon-amber hover:border-neon-amber/50 hover:bg-black/95 xl:right-4 xl:top-4"
                    title={t('viewer.showControls')}
                >
                    <Icon name="eye" size={20} />
                </button>
            )}
        </>
    );
}
