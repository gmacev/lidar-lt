import { DistanceMeasurement } from './DistanceMeasurement';
import { AreaMeasurement } from './AreaMeasurement';
import { AngleMeasurement } from './AngleMeasurement';
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

    // Angle Tool
    isAngleMeasuring: boolean;
    onToggleAngle: () => void;

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
    isAngleMeasuring,
    onToggleAngle,
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

            <AngleMeasurement onClick={onToggleAngle} isActive={isAngleMeasuring} />

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
