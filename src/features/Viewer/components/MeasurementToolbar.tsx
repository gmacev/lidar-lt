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
import type { ViewerToolbarTools } from '@/features/Viewer/hooks/useViewerTools';

interface MeasurementToolbarProps {
    className?: string;
    tools: ViewerToolbarTools;
}

export function MeasurementToolbar({ className = '', tools }: MeasurementToolbarProps) {
    const isTouch = isTouchDevice();
    const scrollRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [scrollState, setScrollState] = useState({
        canScroll: false,
        canScrollUp: false,
        canScrollDown: false,
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
            const canScrollUp = canScroll && scrollTop > 1;
            const canScrollDown = canScroll && scrollTop < maxScrollTop - 1;
            const thumbHeight = canScroll
                ? Math.min(56, Math.max(28, (clientHeight / scrollHeight) * clientHeight))
                : 0;
            const thumbTop =
                canScroll && maxScrollTop > 0
                    ? (scrollTop / maxScrollTop) * (clientHeight - thumbHeight)
                    : 0;

            setScrollState({ canScroll, canScrollUp, canScrollDown, thumbHeight, thumbTop });
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

    const scrollMask =
        scrollState.canScrollUp || scrollState.canScrollDown
            ? `linear-gradient(to bottom, ${
                  scrollState.canScrollUp ? 'transparent 0, black 20px' : 'black 0'
              }, black calc(100% - 20px), ${
                  scrollState.canScrollDown ? 'transparent 100%' : 'black 100%'
              })`
            : undefined;

    return (
        <div className={`relative ${className}`}>
            <div
                ref={scrollRef}
                className="viewer-control-scroll h-full w-full overflow-x-visible overflow-y-auto scroll-smooth"
                style={{
                    maskImage: scrollMask,
                    WebkitMaskImage: scrollMask,
                }}
            >
                <div ref={contentRef} className="flex flex-col items-end gap-1 pb-3">
                    {/* Measurement tools only shown on non-touch devices */}
                    {!isTouch && (
                        <>
                            <DistanceMeasurement
                                onClick={tools.distance.onToggle}
                                isActive={tools.distance.isMeasuring}
                                totalDistance={tools.distance.totalDistance}
                            />
                            <AreaMeasurement
                                onClick={tools.area.onToggle}
                                isActive={tools.area.isMeasuring}
                                totalArea={tools.area.totalArea}
                            />
                            <VolumeMeasurement
                                onClick={tools.volume.onToggle}
                                isActive={tools.volume.isMeasuring}
                                totalVolume={tools.volume.totalVolume}
                            />
                            <CircleMeasurement
                                onClick={tools.circle.onToggle}
                                isActive={tools.circle.isMeasuring}
                            />
                            <AngleMeasurement
                                onClick={tools.angle.onToggle}
                                isActive={tools.angle.isMeasuring}
                            />
                            <AzimuthMeasurement
                                onClick={tools.azimuth.onToggle}
                                isActive={tools.azimuth.isMeasuring}
                            />
                            <HeightProfileMeasurement
                                onClick={tools.profile.onToggle}
                                isActive={tools.profile.isMeasuring}
                            />
                        </>
                    )}

                    {/* Flood simulation works on all devices */}
                    <FloodSimulationTool
                        isActive={tools.flood.isActive}
                        waterLevel={tools.flood.waterLevel}
                        minLevel={tools.flood.minLevel}
                        maxLevel={tools.flood.maxLevel}
                        precision={tools.flood.precision}
                        onStart={tools.flood.onStart}
                        onWaterLevelChange={tools.flood.onWaterLevelChange}
                        onPrecisionChange={tools.flood.onPrecisionChange}
                        onReset={tools.flood.onReset}
                    />

                    {/* Annotation tool works on all devices */}
                    <AnnotationTool
                        annotations={tools.annotations.annotations}
                        isPanelOpen={tools.annotations.isPanelOpen}
                        onTogglePanel={tools.annotations.onTogglePanel}
                        isPlacing={tools.annotations.isPlacing}
                        onStartPlacement={tools.annotations.onStartPlacement}
                        onToggleVisibility={tools.annotations.onToggleVisibility}
                        onToggleAllVisibility={tools.annotations.onToggleAllVisibility}
                        onNavigate={tools.annotations.onNavigate}
                        onDelete={tools.annotations.onDelete}
                        onDeleteAll={tools.annotations.onDeleteAll}
                        allVisible={tools.annotations.allVisible}
                        someVisible={tools.annotations.someVisible}
                    />
                </div>
            </div>

            {scrollState.canScrollUp && (
                <div className="pointer-events-none absolute -top-2 left-1/2 z-10 flex h-3 w-3 -translate-x-1/2 items-center justify-center text-white/55">
                    <span className="block h-1.5 w-1.5 rotate-45 border-l border-t border-current" />
                </div>
            )}

            {scrollState.canScrollDown && (
                <div className="pointer-events-none absolute -bottom-2 left-1/2 z-10 flex h-3 w-3 -translate-x-1/2 items-center justify-center text-white/55">
                    <span className="block h-1.5 w-1.5 rotate-45 border-b border-r border-current" />
                </div>
            )}

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
