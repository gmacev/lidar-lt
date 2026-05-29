import { useEffect, useRef, useState } from 'react';
import { DistanceMeasurement } from './DistanceMeasurement';
import { AreaMeasurement } from './AreaMeasurement';
import { VolumeMeasurement } from './VolumeMeasurement';
import { CircleMeasurement } from './CircleMeasurement';
import { AngleMeasurement } from './AngleMeasurement';
import { AzimuthMeasurement } from './AzimuthMeasurement';
import { HeightProfileMeasurement } from './HeightProfileMeasurement';
import { FloodSimulationTool } from './FloodSimulationTool';
import { AnnotationTool } from './AnnotationTool';
import { isTouchDevice } from '@/common/utils/screenSize';
import type { StoredAnnotation } from '../utils/annotationStorage';

interface MeasurementToolbarProps {
    className?: string;

    // Profile Tool
    isProfileMeasuring: boolean;
    onToggleProfile: () => void;

    // Distance Tool
    isDistanceMeasuring: boolean;
    onToggleDistance: () => void;
    totalDistance: number;

    // Area Tool
    isAreaMeasuring: boolean;
    onToggleArea: () => void;
    totalArea: number;

    // Volume Tool
    isVolumeMeasuring: boolean;
    onToggleVolume: () => void;
    totalVolume: number;

    // Circle Tool
    isCircleMeasuring: boolean;
    onToggleCircle: () => void;

    // Angle Tool
    isAngleMeasuring: boolean;
    onToggleAngle: () => void;

    // Azimuth Tool
    isAzimuthMeasuring: boolean;
    onToggleAzimuth: () => void;

    // Flood Simulation Tool (simplified)
    isFloodActive: boolean;
    floodWaterLevel: number;
    floodMinLevel: number;
    floodMaxLevel: number;
    floodPrecision: number;
    onStartFlood: () => void;
    onFloodWaterLevelChange: (level: number) => void;
    onFloodPrecisionChange: (precision: number) => void;
    onResetFlood: () => void;

    // Annotation Tool
    annotations: StoredAnnotation[];
    isAnnotationPanelOpen: boolean;
    onToggleAnnotationPanel: () => void;
    isAnnotationPlacing: boolean;
    onStartAnnotationPlacement: () => void;
    onToggleAnnotationVisibility: (id: string) => void;
    onToggleAllAnnotationVisibility: () => void;
    onNavigateToAnnotation: (id: string) => void;
    onDeleteAnnotation: (id: string) => void;
    onDeleteAllAnnotations: () => void;
    allAnnotationsVisible: boolean;
    someAnnotationsVisible: boolean;
}

export function MeasurementToolbar({
    className = '',
    isProfileMeasuring,
    onToggleProfile,
    isDistanceMeasuring,
    onToggleDistance,
    totalDistance,
    isAreaMeasuring,
    onToggleArea,
    totalArea,
    isVolumeMeasuring,
    onToggleVolume,
    totalVolume,
    isCircleMeasuring,
    onToggleCircle,
    isAngleMeasuring,
    onToggleAngle,
    isAzimuthMeasuring,
    onToggleAzimuth,
    isFloodActive,
    floodWaterLevel,
    floodMinLevel,
    floodMaxLevel,
    floodPrecision,
    onStartFlood,
    onFloodWaterLevelChange,
    onFloodPrecisionChange,
    onResetFlood,
    annotations,
    isAnnotationPanelOpen,
    onToggleAnnotationPanel,
    isAnnotationPlacing,
    onStartAnnotationPlacement,
    onToggleAnnotationVisibility,
    onToggleAllAnnotationVisibility,
    onNavigateToAnnotation,
    onDeleteAnnotation,
    onDeleteAllAnnotations,
    allAnnotationsVisible,
    someAnnotationsVisible,
}: MeasurementToolbarProps) {
    const isTouch = isTouchDevice();
    const scrollRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [scrollState, setScrollState] = useState({
        canScroll: false,
        thumbHeight: 0,
        thumbTop: 0,
    });

    useEffect(() => {
        const scrollEl = scrollRef.current;
        if (!scrollEl) return;

        const updateScrollIndicator = () => {
            const { clientHeight, scrollHeight, scrollTop } = scrollEl;
            const canScroll = scrollHeight > clientHeight + 1;
            const maxScrollTop = scrollHeight - clientHeight;
            const thumbHeight = canScroll
                ? Math.min(56, Math.max(28, (clientHeight / scrollHeight) * clientHeight))
                : 0;
            const thumbTop =
                canScroll && maxScrollTop > 0
                    ? (scrollTop / maxScrollTop) * (clientHeight - thumbHeight)
                    : 0;

            setScrollState({ canScroll, thumbHeight, thumbTop });
        };

        updateScrollIndicator();
        scrollEl.addEventListener('scroll', updateScrollIndicator, { passive: true });
        window.addEventListener('resize', updateScrollIndicator);

        const resizeObserver = new ResizeObserver(updateScrollIndicator);
        resizeObserver.observe(scrollEl);
        if (contentRef.current) resizeObserver.observe(contentRef.current);

        return () => {
            scrollEl.removeEventListener('scroll', updateScrollIndicator);
            window.removeEventListener('resize', updateScrollIndicator);
            resizeObserver.disconnect();
        };
    }, []);

    return (
        <div className={`relative ${className}`}>
            <div
                ref={scrollRef}
                className="viewer-control-scroll h-full w-full overflow-x-visible overflow-y-auto"
            >
                <div ref={contentRef} className="flex flex-col items-end gap-1">
                    {/* Measurement tools only shown on non-touch devices */}
                    {!isTouch && (
                        <>
                            <DistanceMeasurement
                                onClick={onToggleDistance}
                                isActive={isDistanceMeasuring}
                                totalDistance={totalDistance}
                            />
                            <AreaMeasurement
                                onClick={onToggleArea}
                                isActive={isAreaMeasuring}
                                totalArea={totalArea}
                            />
                            <VolumeMeasurement
                                onClick={onToggleVolume}
                                isActive={isVolumeMeasuring}
                                totalVolume={totalVolume}
                            />
                            <CircleMeasurement
                                onClick={onToggleCircle}
                                isActive={isCircleMeasuring}
                            />
                            <AngleMeasurement onClick={onToggleAngle} isActive={isAngleMeasuring} />
                            <AzimuthMeasurement
                                onClick={onToggleAzimuth}
                                isActive={isAzimuthMeasuring}
                            />
                            <HeightProfileMeasurement
                                onClick={onToggleProfile}
                                isActive={isProfileMeasuring}
                            />
                        </>
                    )}

                    {/* Flood simulation works on all devices */}
                    <FloodSimulationTool
                        isActive={isFloodActive}
                        waterLevel={floodWaterLevel}
                        minLevel={floodMinLevel}
                        maxLevel={floodMaxLevel}
                        precision={floodPrecision}
                        onStart={onStartFlood}
                        onWaterLevelChange={onFloodWaterLevelChange}
                        onPrecisionChange={onFloodPrecisionChange}
                        onReset={onResetFlood}
                    />

                    {/* Annotation tool works on all devices */}
                    <AnnotationTool
                        annotations={annotations}
                        isPanelOpen={isAnnotationPanelOpen}
                        onTogglePanel={onToggleAnnotationPanel}
                        isPlacing={isAnnotationPlacing}
                        onStartPlacement={onStartAnnotationPlacement}
                        onToggleVisibility={onToggleAnnotationVisibility}
                        onToggleAllVisibility={onToggleAllAnnotationVisibility}
                        onNavigate={onNavigateToAnnotation}
                        onDelete={onDeleteAnnotation}
                        onDeleteAll={onDeleteAllAnnotations}
                        allVisible={allAnnotationsVisible}
                        someVisible={someAnnotationsVisible}
                    />
                </div>
            </div>
            {scrollState.canScroll && (
                <div className="pointer-events-none absolute -right-1 top-0 bottom-0 w-0.5">
                    <div
                        className="absolute right-0 w-0.5 rounded-full bg-white/30"
                        style={{
                            height: scrollState.thumbHeight,
                            transform: `translateY(${scrollState.thumbTop}px)`,
                        }}
                    />
                </div>
            )}
        </div>
    );
}
