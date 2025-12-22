import { DistanceMeasurement } from './DistanceMeasurement';
import { AreaMeasurement } from './AreaMeasurement';
import { CircleMeasurement } from './CircleMeasurement';
import { AngleMeasurement } from './AngleMeasurement';
import { AzimuthMeasurement } from './AzimuthMeasurement';
import { HeightProfileMeasurement } from './HeightProfileMeasurement';
import { FloodSimulationTool } from './FloodSimulationTool';

interface MeasurementToolbarProps {
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
}

export function MeasurementToolbar({
    isProfileMeasuring,
    onToggleProfile,
    isDistanceMeasuring,
    onToggleDistance,
    totalDistance,
    isAreaMeasuring,
    onToggleArea,
    totalArea,
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
}: MeasurementToolbarProps) {
    return (
        <div className="flex flex-col items-end gap-1">
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
            <CircleMeasurement onClick={onToggleCircle} isActive={isCircleMeasuring} />
            <AngleMeasurement onClick={onToggleAngle} isActive={isAngleMeasuring} />
            <AzimuthMeasurement onClick={onToggleAzimuth} isActive={isAzimuthMeasuring} />
            <HeightProfileMeasurement onClick={onToggleProfile} isActive={isProfileMeasuring} />

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
        </div>
    );
}
