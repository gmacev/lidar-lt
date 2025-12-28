import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import debounce from 'lodash/debounce';
import {
    usePotree,
    useProfileData,
    useProfileTool,
    useDistanceMeasurementTool,
    useAreaMeasurementTool,
    useAngleMeasurementTool,
    useAzimuthMeasurementTool,
    useCircleMeasurementTool,
    useFloodSimulation,
} from '@/features/Viewer/hooks';
import { useVolumeMeasurementTool } from '@/features/Viewer/hooks/useVolumeMeasurementTool';
import { useVolumeMeasurementData } from '@/features/Viewer/hooks/useVolumeMeasurementData';
import { useDistanceMeasurementData } from '@/features/Viewer/hooks/useDistanceMeasurementData';
import { useAreaMeasurementData } from '@/features/Viewer/hooks/useAreaMeasurementData';
import { useAngleMeasurementData } from '@/features/Viewer/hooks/useAngleMeasurementData';
import { useAzimuthMeasurementData } from '@/features/Viewer/hooks/useAzimuthMeasurementData';
import { useCircleMeasurementData } from '@/features/Viewer/hooks/useCircleMeasurementData';
import { MeasurementToolbar } from './MeasurementToolbar';
import type { MeasurementType } from '@/features/Viewer/types/measurement';
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
    } = useDistanceMeasurementTool({ viewerRef });

    const { exportToCsv: exportDistanceCsv } = useDistanceMeasurementData({ viewerRef });
    const { exportToCsv: exportAreaCsv } = useAreaMeasurementData({ viewerRef });
    const { exportToCsv: exportAngleCsv } = useAngleMeasurementData({ viewerRef });
    const { exportToCsv: exportAzimuthCsv } = useAzimuthMeasurementData({ viewerRef });
    const { exportToCsv: exportCircleCsv } = useCircleMeasurementData({ viewerRef });

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

    // Angle Measurement Tool State
    const {
        isMeasuring: isAngleMeasuring,
        pointCount: anglePointCount,
        toggleAngleMeasurement: _toggleAngleMeasurement,
        menuPosition: angleMenuPosition,
        setMenuPosition: setAngleMenuPosition,
        deleteLastPoint: deleteLastAnglePoint,
        deleteAll: deleteAllAngles,
    } = useAngleMeasurementTool({ viewerRef });

    // Azimuth Measurement Tool State
    const {
        isMeasuring: isAzimuthMeasuring,
        pointCount: azimuthPointCount,
        toggleAzimuthMeasurement: _toggleAzimuthMeasurement,
        menuPosition: azimuthMenuPosition,
        setMenuPosition: setAzimuthMenuPosition,
        deleteLastPoint: deleteLastAzimuthPoint,
        deleteAll: deleteAllAzimuths,
    } = useAzimuthMeasurementTool({ viewerRef });

    // Circle Measurement Tool State
    const {
        isMeasuring: isCircleMeasuring,
        pointCount: circlePointCount,
        toggleCircleMeasurement: _toggleCircleMeasurement,
        menuPosition: circleMenuPosition,
        setMenuPosition: setCircleMenuPosition,
        deleteLastPoint: deleteLastCirclePoint,
        deleteAll: deleteAllCircles,
    } = useCircleMeasurementTool({ viewerRef });

    // Volume Measurement Tool State
    const {
        isMeasuring: isVolumeMeasuring,
        totalVolume,
        toggleVolumeMeasurement: _toggleVolumeMeasurement,
        menuPosition: volumeMenuPosition,
        setMenuPosition: setVolumeMenuPosition,
        deleteAll: deleteAllVolumes,
    } = useVolumeMeasurementTool({ viewerRef });

    const { exportToCsv: exportVolumeCsv } = useVolumeMeasurementData({ viewerRef });

    // Profile Tool State
    const {
        isMeasuring: isProfileMeasuring,
        toggleProfileMeasurement: _toggleProfileMeasurement,
        menuPosition,
        setMenuPosition,
        resetProfile,
        deleteLastPoint,
    } = useProfileTool({ viewerRef });

    // Flood Simulation Tool State
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
    const measurements: Record<MeasurementType, { isActive: boolean; deactivate: () => void }> = {
        distance: { isActive: isDistanceMeasuring, deactivate: _toggleDistanceMeasurement },
        area: { isActive: isAreaMeasuring, deactivate: _toggleAreaMeasurement },
        volume: { isActive: isVolumeMeasuring, deactivate: _toggleVolumeMeasurement },
        profile: { isActive: isProfileMeasuring, deactivate: _toggleProfileMeasurement },
        flood: { isActive: isFloodActive, deactivate: resetFlood },
        angle: { isActive: isAngleMeasuring, deactivate: _toggleAngleMeasurement },
        azimuth: { isActive: isAzimuthMeasuring, deactivate: _toggleAzimuthMeasurement },
        circle: { isActive: isCircleMeasuring, deactivate: _toggleCircleMeasurement },
    };

    const createHandler = (type: MeasurementType, action: () => void) => () => {
        Object.entries(measurements).forEach(([key, { isActive, deactivate }]) => {
            if (key !== type && isActive) deactivate();
        });
        action();
    };

    const handleToggleDistance = createHandler('distance', _toggleDistanceMeasurement);
    const handleToggleArea = createHandler('area', _toggleAreaMeasurement);
    const handleToggleVolume = createHandler('volume', _toggleVolumeMeasurement);
    const handleToggleProfile = createHandler('profile', _toggleProfileMeasurement);
    const handleStartFlood = createHandler('flood', _startFlood);
    const handleToggleAngle = createHandler('angle', _toggleAngleMeasurement);
    const handleToggleAzimuth = createHandler('azimuth', _toggleAzimuthMeasurement);
    const handleToggleCircle = createHandler('circle', _toggleCircleMeasurement);

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
                    {/* Sector info + Coordinate Search - bottom center, always */}
                    {!isLoading && !error && (
                        <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
                            <CoordinateSearchControl
                                viewerRef={viewerRef}
                                sectorName={initialState.sectorName}
                                cellId={cellId}
                            />
                        </div>
                    )}

                    {/* Language switcher, UI toggle, and Controls - top right corner */}
                    <div className="absolute right-2 top-2 flex items-start gap-2 xl:right-4 xl:top-4">
                        <LanguageSwitcher />
                        <button
                            onClick={() => setUiVisible(!uiVisible)}
                            className="flex h-10 w-10 items-center justify-center rounded-lg backdrop-blur-md border transition-all bg-void-black/60 border-white/10 text-white/70 hover:text-neon-cyan hover:border-neon-cyan/50 hover:bg-white/10"
                            title={uiVisible ? t('viewer.hideControls') : t('viewer.showControls')}
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
                            </ul>
                        </GlassPanel>
                    </div>

                    {/* Measurement Tools - only visible when UI is visible */}
                    {!isLoading && !error && (
                        <div className="absolute right-2 top-16 flex flex-col items-end gap-1 md:top-[140px] xl:right-4">
                            <MeasurementToolbar
                                isProfileMeasuring={isProfileMeasuring}
                                onToggleProfile={handleToggleProfile}
                                isDistanceMeasuring={isDistanceMeasuring}
                                onToggleDistance={handleToggleDistance}
                                totalDistance={totalDistance}
                                isAreaMeasuring={isAreaMeasuring}
                                onToggleArea={handleToggleArea}
                                totalArea={totalArea}
                                isVolumeMeasuring={isVolumeMeasuring}
                                onToggleVolume={handleToggleVolume}
                                totalVolume={totalVolume}
                                isCircleMeasuring={isCircleMeasuring}
                                onToggleCircle={handleToggleCircle}
                                isAngleMeasuring={isAngleMeasuring}
                                onToggleAngle={handleToggleAngle}
                                isAzimuthMeasuring={isAzimuthMeasuring}
                                onToggleAzimuth={handleToggleAzimuth}
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

                    {/* Circle Context Menu */}
                    {circleMenuPosition && (
                        <MeasurementContext
                            x={circleMenuPosition.x}
                            y={circleMenuPosition.y}
                            onClose={() => setCircleMenuPosition(null)}
                            onDeleteLast={deleteLastCirclePoint}
                            onDeleteAll={deleteAllCircles}
                            onExportCsv={() => exportCircleCsv(cellId)}
                            disableExport={circlePointCount < 3}
                        />
                    )}

                    {/* Angle Context Menu */}
                    {angleMenuPosition && (
                        <MeasurementContext
                            x={angleMenuPosition.x}
                            y={angleMenuPosition.y}
                            onClose={() => setAngleMenuPosition(null)}
                            onDeleteLast={deleteLastAnglePoint}
                            onDeleteAll={deleteAllAngles}
                            onExportCsv={() => exportAngleCsv(cellId)}
                            disableExport={anglePointCount < 3}
                        />
                    )}

                    {/* Azimuth Context Menu */}
                    {azimuthMenuPosition && (
                        <MeasurementContext
                            x={azimuthMenuPosition.x}
                            y={azimuthMenuPosition.y}
                            onClose={() => setAzimuthMenuPosition(null)}
                            onDeleteLast={deleteLastAzimuthPoint}
                            onDeleteAll={deleteAllAzimuths}
                            onExportCsv={() => exportAzimuthCsv(cellId)}
                            disableExport={azimuthPointCount < 2}
                        />
                    )}

                    {/* Volume Context Menu */}
                    {volumeMenuPosition && (
                        <MeasurementContext
                            x={volumeMenuPosition.x}
                            y={volumeMenuPosition.y}
                            onClose={() => setVolumeMenuPosition(null)}
                            onDeleteAll={deleteAllVolumes}
                            onExportCsv={() => exportVolumeCsv(cellId)}
                            disableExport={totalVolume === 0}
                        />
                    )}

                    {/* Unified Sidebar - handles its own positioning */}
                    {!isLoading && !error && (
                        <ViewerSidebar
                            viewerRef={viewerRef}
                            initialState={initialState}
                            updateUrl={updateUrl}
                            onBack={onBack}
                        />
                    )}
                </>
            )}

            {/* UI Toggle button - ALWAYS visible, top right next to language switcher */}
            {!uiVisible && (
                <button
                    onClick={() => setUiVisible(!uiVisible)}
                    className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-lg backdrop-blur-md border transition-all z-20 bg-neon-cyan/30 border-neon-cyan text-neon-cyan shadow-[0_0_12px_rgba(0,255,255,0.3)] xl:right-4 xl:top-4"
                    title={t('viewer.showControls')}
                >
                    <Icon name="eye" size={20} />
                </button>
            )}

            {/* Compass + Google Maps button - bottom right, only visible when UI is visible */}
            {uiVisible && (
                <div className="absolute bottom-2 right-2 flex flex-col items-center gap-10 xl:bottom-4 xl:right-4">
                    <GoogleMapsButton viewerRef={viewerRef} />
                    <Compass viewerRef={viewerRef} />
                </div>
            )}
        </div>
    );
}
