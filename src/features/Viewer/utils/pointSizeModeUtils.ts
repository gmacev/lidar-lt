import type { Potree } from '@/common/types/potree';
import type { PointSizeMode } from '@/features/Viewer/config';

export function getPointSizeModeEnumValue(mode: PointSizeMode, PotreeLib: Potree) {
    switch (mode) {
        case 'fixed':
            return PotreeLib.PointSizeType.FIXED;
        case 'adaptive':
        default:
            return PotreeLib.PointSizeType.ADAPTIVE;
    }
}
