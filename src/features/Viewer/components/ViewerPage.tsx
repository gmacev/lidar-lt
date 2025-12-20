import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import debounce from 'lodash/debounce';
import {
    usePotree,
    useProfileData,
    useProfileTool,
    useMeasurementTool,
    useAreaMeasurementTool,
    useFloodSimulation,
} from '@/features/Viewer/hooks';
import { useDistanceMeasurementData } from '@/features/Viewer/hooks/useDistanceMeasurementData';
import { useAreaMeasurementData } from '@/features/Viewer/hooks/useAreaMeasurementData';
import { MeasurementToolbar } from './MeasurementToolbar';
import { ViewerSidebar } from './ViewerSidebar';
import { Compass } from './Compass';
import { CoordinateSearchControl } from './CoordinateSearchControl';
import { GoogleMapsButton } from './GoogleMapsButton';

import { GlassPanel, NeonButton, DataLoader, Icon, LanguageSwitcher } from '@/common/components';
import { MeasurementContext } from './MeasurementContext';
import type { ViewerState } from '@/features/Viewer/config/viewerConfig';
import { Route } from '@/routes/viewer.$cellId';

interface ViewerPageProps {
    cellId: string;
    onBack: () => void;
    initialState: ViewerState;
}

export function ViewerPage({ cellId, onBack, initialState }: ViewerPageProps) {
    const { t } = useTranslation();
    const navigate = useNavigate({ from: Route.fullPath });
    const eptBaseUrl = import.meta.env.VITE_EPT_BASE_URL;
    const dataUrl = `${eptBaseUrl}/${cellId}/potree_output/metadata.json`;
    const [uiVisible, setUiVisible] = useState(true);

    const updateUrlDebounced = debounce((state: Partial<ViewerState>) => {
        void navigate({
            search: (prev) => ({ ...prev, ...state }),
            replace: true,
        });
    }, 500);

    // Create immediate URL updater for control settings (no debounce needed)
    const updateUrl = (state: Partial<ViewerState>) => {
        void navigate({
            search: (prev) => ({ ...prev, ...state }),
            replace: true,
        });
    };

    // Cancel any pending debounced URL updates on unmount to prevent
    // stale updates after navigation (e.g., pressing back button)
    useEffect(() => {
        return () => {
            updateUrlDebounced.cancel();
        };
    }, [updateUrlDebounced]);

    const { containerRef, viewerRef, isLoading, error } = usePotree({
        dataUrl,
        initialState,
        updateUrl: updateUrlDebounced,
    });

    // Get profile data for CSV export
    const { exportToCsv: exportProfileCsv } = useProfileData({ viewerRef });

    // Distance Measurement Tool State
    const {
        isMeasuring: isDistanceMeasuring,
        toggleDistanceMeasurement: _toggleDistanceMeasurement,
        menuPosition: distanceMenuPosition,
        setMenuPosition: setDistanceMenuPosition,
        deleteLastPoint: deleteLastDistancePoint,
        deleteAll: deleteAllDistances,
        totalDistance,
    } = useMeasurementTool({ viewerRef });

    const { exportToCsv: exportDistanceCsv } = useDistanceMeasurementData({ viewerRef });

    // Area Measurement Tool State
    const {
        isMeasuring: isAreaMeasuring,
        toggleAreaMeasurement: _toggleAreaMeasurement,
        menuPosition: areaMenuPosition,
        setMenuPosition: setAreaMenuPosition,
        deleteLastPoint: deleteLastAreaPoint,
        deleteAll: deleteAllAreas,
        totalArea,
    } = useAreaMeasurementTool({ viewerRef });

    const { exportToCsv: exportAreaCsv } = useAreaMeasurementData({ viewerRef });

    // Profile Tool State (Lifted from MeasurementToolbar)
    const {
        isMeasuring: isProfileMeasuring,
        toggleProfileMeasurement: _toggleProfileMeasurement,
        menuPosition,
        setMenuPosition,
        resetProfile,
        deleteLastPoint,
    } = useProfileTool({ viewerRef });

    // Flood Simulation Tool State (simplified - no drawing)
    const {
        isActive: isFloodActive,
        waterLevel: floodWaterLevel,
        minElevation: floodMinLevel,
        maxElevation: floodMaxLevel,
        precision: floodPrecision,
        start: _startFlood,
        setWaterLevel: setFloodWaterLevel,
        setPrecision: setFloodPrecision,
        reset: resetFlood,
    } = useFloodSimulation({ viewerRef, metadataUrl: dataUrl });

    // Mutual exclusivity handlers - cancel other tools when starting a new one
    const handleToggleDistance = () => {
        if (isAreaMeasuring) _toggleAreaMeasurement();
        if (isProfileMeasuring) _toggleProfileMeasurement();
        if (isFloodActive) resetFlood();
        _toggleDistanceMeasurement();
    };

    const handleToggleArea = () => {
        if (isDistanceMeasuring) _toggleDistanceMeasurement();
        if (isProfileMeasuring) _toggleProfileMeasurement();
        if (isFloodActive) resetFlood();
        _toggleAreaMeasurement();
    };

    const handleToggleProfile = () => {
        if (isDistanceMeasuring) _toggleDistanceMeasurement();
        if (isAreaMeasuring) _toggleAreaMeasurement();
        if (isFloodActive) resetFlood();
        _toggleProfileMeasurement();
    };

    const handleStartFlood = () => {
        if (isDistanceMeasuring) _toggleDistanceMeasurement();
        if (isAreaMeasuring) _toggleAreaMeasurement();
        if (isProfileMeasuring) _toggleProfileMeasurement();
        _startFlood();
    };

    return (
        <div className="relative h-screen w-screen bg-void-black">
            <div ref={containerRef} className="h-full w-full" />

            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-void-black/80">
                    <DataLoader message={t('viewer.loading')} />
                </div>
            )}

            {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-void-black/80">
                    <GlassPanel className="max-w-md text-center">
                        <p className="text-plasma-red mb-4">
                            {t('viewer.error')}: {error}
                        </p>
                        <NeonButton variant="amber" onClick={onBack}>
                            {t('viewer.back')}
                        </NeonButton>
                    </GlassPanel>
                </div>
            )}

            {/* UI elements that can be toggled */}
            {uiVisible && (
                <>
                    {/* Sector info + Coordinate Search - top center */}
                    {!isLoading && !error && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2">
                            <CoordinateSearchControl
                                viewerRef={viewerRef}
                                sectorName={initialState.sectorName}
                                cellId={cellId}
                            />
                        </div>
                    )}

                    <div className="absolute left-4 top-4">
                        <NeonButton variant="amber" onClick={onBack}>
                            {t('viewer.back')}
                        </NeonButton>
                    </div>

                    {/* Language switcher - top right corner */}
                    <div className="absolute right-4 top-4 flex items-start gap-4">
                        <LanguageSwitcher />
                        <GlassPanel className="w-64">
                            <h3 className="mb-2 text-sm font-bold text-neon-amber">
                                {t('viewer.controls')}
                            </h3>
                            <ul className="space-y-1 text-xs text-white/70">
                                <li>{t('viewer.controlLeftClick')}</li>
                                <li>{t('viewer.controlRightClick')}</li>
                                <li>{t('viewer.controlScroll')}</li>
                            </ul>
                        </GlassPanel>
                    </div>

                    {/* Measurement Tools - only visible when UI is visible */}
                    {!isLoading && !error && (
                        <div className="absolute right-4 top-[140px] flex flex-col items-end gap-1">
                            <MeasurementToolbar
                                isProfileMeasuring={isProfileMeasuring}
                                onToggleProfile={handleToggleProfile}
                                isDistanceMeasuring={isDistanceMeasuring}
                                onToggleDistance={handleToggleDistance}
                                totalDistance={totalDistance}
                                isAreaMeasuring={isAreaMeasuring}
                                onToggleArea={handleToggleArea}
                                totalArea={totalArea}
                                isFloodActive={isFloodActive}
                                floodWaterLevel={floodWaterLevel}
                                floodMinLevel={floodMinLevel}
                                floodMaxLevel={floodMaxLevel}
                                floodPrecision={floodPrecision}
                                onStartFlood={handleStartFlood}
                                onFloodWaterLevelChange={setFloodWaterLevel}
                                onFloodPrecisionChange={setFloodPrecision}
                                onResetFlood={resetFlood}
                            />
                        </div>
                    )}

                    {/* Profile Context Menu */}
                    {menuPosition && (
                        <MeasurementContext
                            x={menuPosition.x}
                            y={menuPosition.y}
                            onClose={() => setMenuPosition(null)}
                            onDeleteLast={deleteLastPoint}
                            onDeleteAll={resetProfile}
                            onExportCsv={() => exportProfileCsv(cellId)}
                        />
                    )}

                    {/* Distance Context Menu */}
                    {distanceMenuPosition && (
                        <MeasurementContext
                            x={distanceMenuPosition.x}
                            y={distanceMenuPosition.y}
                            onClose={() => setDistanceMenuPosition(null)}
                            onDeleteLast={deleteLastDistancePoint}
                            onDeleteAll={deleteAllDistances}
                            onExportCsv={() => exportDistanceCsv(cellId)}
                        />
                    )}

                    {/* Area Context Menu */}
                    {areaMenuPosition && (
                        <MeasurementContext
                            x={areaMenuPosition.x}
                            y={areaMenuPosition.y}
                            onClose={() => setAreaMenuPosition(null)}
                            onDeleteLast={deleteLastAreaPoint}
                            onDeleteAll={deleteAllAreas}
                            onExportCsv={() => exportAreaCsv(cellId)}
                        />
                    )}

                    {/* Unified Sidebar - left side, vertically centered */}
                    {!isLoading && !error && (
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
                            <ViewerSidebar
                                viewerRef={viewerRef}
                                initialState={initialState}
                                updateUrl={updateUrl}
                            />
                        </div>
                    )}
                </>
            )}

            {/* UI Toggle button - ALWAYS visible, vertically centered on right */}
            <button
                onClick={() => setUiVisible(!uiVisible)}
                className={`absolute right-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-lg backdrop-blur-md border transition-all z-20 ${
                    !uiVisible
                        ? 'bg-neon-cyan/30 border-neon-cyan text-neon-cyan shadow-[0_0_12px_rgba(0,255,255,0.3)]'
                        : 'bg-void-black/60 border-white/10 text-white/70 hover:text-neon-cyan hover:border-neon-cyan/50 hover:bg-white/10'
                }`}
                title={uiVisible ? t('viewer.hideControls') : t('viewer.showControls')}
            >
                <Icon name={uiVisible ? 'eyeOff' : 'eye'} size={20} />
            </button>

            {/* Compass + Google Maps button - bottom right, only visible when UI is visible */}
            {uiVisible && (
                <div className="absolute bottom-4 right-4 flex flex-col items-center gap-10">
                    <GoogleMapsButton viewerRef={viewerRef} />
                    <Compass viewerRef={viewerRef} />
                </div>
            )}
        </div>
    );
}
