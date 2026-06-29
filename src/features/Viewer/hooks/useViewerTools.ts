import { useState, type RefObject } from 'react';
import type { PotreeViewer } from '@/common/types/potree';
import { PROFILE_WIDTH_DEFAULTS, type ViewerState } from '@/features/Viewer/config/viewerConfig';
import { useMarkers } from '@/features/Viewer/hooks/useMarkers';
import {
    useAreaMeasurementTool,
    useAngleMeasurementTool,
    useAzimuthMeasurementTool,
    useCircleMeasurementTool,
    useDistanceMeasurementTool,
    useFloodSimulation,
    useKvrInspectTool,
    useProfileData,
    useProfileTool,
} from '@/features/Viewer/hooks';
import { useVolumeMeasurementTool } from '@/features/Viewer/hooks/useVolumeMeasurementTool';
import { useVolumeMeasurementData } from '@/features/Viewer/hooks/useVolumeMeasurementData';
import { useDistanceMeasurementData } from '@/features/Viewer/hooks/useDistanceMeasurementData';
import { useAreaMeasurementData } from '@/features/Viewer/hooks/useAreaMeasurementData';
import { useAngleMeasurementData } from '@/features/Viewer/hooks/useAngleMeasurementData';
import { useAzimuthMeasurementData } from '@/features/Viewer/hooks/useAzimuthMeasurementData';
import { useCircleMeasurementData } from '@/features/Viewer/hooks/useCircleMeasurementData';
import { useAnnotations } from '@/features/Viewer/hooks/useAnnotations';
import type {
    ProfileBin,
    ProfileDataStatus,
    ProfileSample,
    ProfileSegment,
    ProfileSummary,
} from '@/features/Viewer/hooks/useProfileData';
import type { ProfilePhase } from '@/features/Viewer/hooks/useProfileTool';
import type { StoredAnnotation } from '@/features/Viewer/utils/annotationStorage';
import type {
    KvrInspectState,
    KvrMatchFocusRequest,
} from '@/features/Viewer/hooks/useKvrInspectTool';
import type { KvrMatch } from '@/features/Viewer/utils/kvrClient';
import { useExclusiveViewerTool, type ExclusiveViewerTool } from './useExclusiveViewerTool';

interface UseViewerToolsOptions {
    viewerRef: RefObject<PotreeViewer | null>;
    cellId: string;
    dataUrl: string;
    markerParam?: string;
    onMarkerSearchChange: (state: Partial<ViewerState>) => void;
}

export type ViewerMarkersModel = ReturnType<typeof useMarkers>;

export interface ViewerToolbarTools {
    annotations: {
        annotations: StoredAnnotation[];
        isPanelOpen: boolean;
        isPlacing: boolean;
        allVisible: boolean;
        someVisible: boolean;
        onTogglePanel: () => void;
        onStartPlacement: () => void;
        onToggleVisibility: (id: string) => void;
        onToggleAllVisibility: () => void;
        onNavigate: (id: string) => void;
        onDelete: (id: string) => void;
        onDeleteAll: () => void;
    };
    area: {
        isMeasuring: boolean;
        onToggle: () => void;
        totalArea: number;
    };
    angle: {
        isMeasuring: boolean;
        onToggle: () => void;
    };
    azimuth: {
        isMeasuring: boolean;
        onToggle: () => void;
    };
    circle: {
        isMeasuring: boolean;
        onToggle: () => void;
    };
    distance: {
        isMeasuring: boolean;
        onToggle: () => void;
        totalDistance: number;
    };
    flood: {
        isActive: boolean;
        waterLevel: number;
        minLevel: number;
        maxLevel: number;
        precision: number;
        onStart: () => void;
        onWaterLevelChange: (level: number) => void;
        onPrecisionChange: (precision: number) => void;
        onReset: () => void;
    };
    profile: {
        isMeasuring: boolean;
        onToggle: () => void;
    };
    volume: {
        isMeasuring: boolean;
        onToggle: () => void;
        totalVolume: number;
    };
}

export interface ViewerKvrToolModel {
    focusRequest: KvrMatchFocusRequest | null;
    inspectState: KvrInspectState;
    isInspecting: boolean;
    isPopoverOpen: boolean;
    onClose: () => void;
    onRetry: () => void;
    onFocusMatch: (match: KvrMatch) => void;
    onToggle: () => void;
}

export interface MeasurementContextMenuModel {
    id: string;
    position: { x: number; y: number };
    onClose: () => void;
    onDeleteLast?: () => void;
    onDeleteAll: () => void;
    onExportCsv?: () => void;
    disableExport?: boolean;
}

export interface ViewerProfilePanelModel {
    activeProfileUuid?: string;
    bins: ProfileBin[];
    isMeasuring: boolean;
    isPanelCollapsed: boolean;
    onClose: () => void;
    onCollapsedChange: (collapsed: boolean) => void;
    onDeleteLast: () => void;
    onExport: () => void;
    onFinish: () => void;
    onNewProfile: () => void;
    onWidthChange: (width: number) => void;
    phase: ProfilePhase;
    revision: number;
    sample: ProfileSample;
    segments: ProfileSegment[];
    status: ProfileDataStatus;
    summary: ProfileSummary;
    width: number;
}

export interface ViewerCursorState {
    isAnnotationPlacing: boolean;
    isKvrInspecting: boolean;
}

export function useViewerTools({
    viewerRef,
    cellId,
    dataUrl,
    markerParam,
    onMarkerSearchChange,
}: UseViewerToolsOptions) {
    const markers = useMarkers({
        viewerRef,
        markerParam,
        onSearchChange: onMarkerSearchChange,
    });

    const distance = useDistanceMeasurementTool({ viewerRef });
    const area = useAreaMeasurementTool({ viewerRef });
    const angle = useAngleMeasurementTool({ viewerRef });
    const azimuth = useAzimuthMeasurementTool({ viewerRef });
    const circle = useCircleMeasurementTool({ viewerRef });
    const volume = useVolumeMeasurementTool({ viewerRef });

    const { exportToCsv: exportDistanceCsv } = useDistanceMeasurementData({ viewerRef });
    const { exportToCsv: exportAreaCsv } = useAreaMeasurementData({ viewerRef });
    const { exportToCsv: exportAngleCsv } = useAngleMeasurementData({ viewerRef });
    const { exportToCsv: exportAzimuthCsv } = useAzimuthMeasurementData({ viewerRef });
    const { exportToCsv: exportCircleCsv } = useCircleMeasurementData({ viewerRef });
    const { exportToCsv: exportVolumeCsv } = useVolumeMeasurementData({ viewerRef });

    const profileTool = useProfileTool({ viewerRef });
    const isProfileMeasuring = profileTool.phase !== 'idle';
    const [profileWidth, setProfileWidthState] = useState<number>(PROFILE_WIDTH_DEFAULTS.default);
    const [isProfilePanelCollapsed, setIsProfilePanelCollapsed] = useState(false);
    const profileData = useProfileData({ viewerRef, profile: profileTool.activeProfile });

    const flood = useFloodSimulation({ viewerRef, metadataUrl: dataUrl });
    const annotations = useAnnotations({ viewerRef, sectorId: cellId });
    const kvr = useKvrInspectTool({ viewerRef });

    const exclusiveTools: ExclusiveViewerTool[] = [
        {
            id: 'distance',
            isActive: distance.isMeasuring,
            deactivate: distance.toggleDistanceMeasurement,
        },
        { id: 'area', isActive: area.isMeasuring, deactivate: area.toggleAreaMeasurement },
        {
            id: 'volume',
            isActive: volume.isMeasuring,
            deactivate: volume.toggleVolumeMeasurement,
        },
        {
            id: 'profile',
            isActive: isProfileMeasuring,
            deactivate: profileTool.toggleProfileMeasurement,
        },
        { id: 'flood', isActive: flood.isActive, deactivate: flood.reset },
        { id: 'angle', isActive: angle.isMeasuring, deactivate: angle.toggleAngleMeasurement },
        {
            id: 'azimuth',
            isActive: azimuth.isMeasuring,
            deactivate: azimuth.toggleAzimuthMeasurement,
        },
        { id: 'circle', isActive: circle.isMeasuring, deactivate: circle.toggleCircleMeasurement },
        {
            id: 'annotation',
            isActive: annotations.isPanelOpen,
            deactivate: annotations.closePanel,
        },
        {
            id: 'kvr',
            isActive: kvr.isInspecting || kvr.isPopoverOpen,
            deactivate: kvr.closePopover,
        },
    ];
    const { createHandler } = useExclusiveViewerTool(exclusiveTools);

    const handleProfileWidthChange = (width: number) => {
        setProfileWidthState(width);
        profileTool.setProfileWidth(width);
    };

    const handleToggleProfile = createHandler('profile', () => {
        if (!isProfileMeasuring) {
            setProfileWidthState(PROFILE_WIDTH_DEFAULTS.default);
            setIsProfilePanelCollapsed(false);
        }
        profileTool.toggleProfileMeasurement();
    });

    const toolbar: ViewerToolbarTools = {
        annotations: {
            annotations: annotations.annotations,
            isPanelOpen: annotations.isPanelOpen,
            isPlacing: annotations.isPlacing,
            allVisible: annotations.allVisible,
            someVisible: annotations.someVisible,
            onTogglePanel: createHandler('annotation', annotations.togglePanel),
            onStartPlacement: annotations.startPlacement,
            onToggleVisibility: annotations.toggleVisibility,
            onToggleAllVisibility: annotations.toggleAllVisibility,
            onNavigate: annotations.navigateToAnnotation,
            onDelete: annotations.deleteAnnotation,
            onDeleteAll: annotations.deleteAllAnnotations,
        },
        area: {
            isMeasuring: area.isMeasuring,
            onToggle: createHandler('area', area.toggleAreaMeasurement),
            totalArea: area.totalArea,
        },
        angle: {
            isMeasuring: angle.isMeasuring,
            onToggle: createHandler('angle', angle.toggleAngleMeasurement),
        },
        azimuth: {
            isMeasuring: azimuth.isMeasuring,
            onToggle: createHandler('azimuth', azimuth.toggleAzimuthMeasurement),
        },
        circle: {
            isMeasuring: circle.isMeasuring,
            onToggle: createHandler('circle', circle.toggleCircleMeasurement),
        },
        distance: {
            isMeasuring: distance.isMeasuring,
            onToggle: createHandler('distance', distance.toggleDistanceMeasurement),
            totalDistance: distance.totalDistance,
        },
        flood: {
            isActive: flood.isActive,
            waterLevel: flood.waterLevel,
            minLevel: flood.minElevation,
            maxLevel: flood.maxElevation,
            precision: flood.precision,
            onStart: createHandler('flood', flood.start),
            onWaterLevelChange: flood.setWaterLevel,
            onPrecisionChange: flood.setPrecision,
            onReset: flood.reset,
        },
        profile: {
            isMeasuring: isProfileMeasuring,
            onToggle: handleToggleProfile,
        },
        volume: {
            isMeasuring: volume.isMeasuring,
            onToggle: createHandler('volume', volume.toggleVolumeMeasurement),
            totalVolume: volume.totalVolume,
        },
    };

    const contextMenus: MeasurementContextMenuModel[] = [];
    if (distance.menuPosition) {
        contextMenus.push({
            id: 'distance',
            position: distance.menuPosition,
            onClose: () => distance.setMenuPosition(null),
            onDeleteLast: distance.deleteLastPoint,
            onDeleteAll: distance.deleteAll,
            onExportCsv: () => exportDistanceCsv(cellId),
        });
    }
    if (area.menuPosition) {
        contextMenus.push({
            id: 'area',
            position: area.menuPosition,
            onClose: () => area.setMenuPosition(null),
            onDeleteLast: area.deleteLastPoint,
            onDeleteAll: area.deleteAll,
            onExportCsv: () => exportAreaCsv(cellId),
        });
    }
    if (circle.menuPosition) {
        contextMenus.push({
            id: 'circle',
            position: circle.menuPosition,
            onClose: () => circle.setMenuPosition(null),
            onDeleteLast: circle.deleteLastPoint,
            onDeleteAll: circle.deleteAll,
            onExportCsv: () => exportCircleCsv(cellId),
            disableExport: circle.pointCount < 3,
        });
    }
    if (angle.menuPosition) {
        contextMenus.push({
            id: 'angle',
            position: angle.menuPosition,
            onClose: () => angle.setMenuPosition(null),
            onDeleteLast: angle.deleteLastPoint,
            onDeleteAll: angle.deleteAll,
            onExportCsv: () => exportAngleCsv(cellId),
            disableExport: angle.pointCount < 3,
        });
    }
    if (azimuth.menuPosition) {
        contextMenus.push({
            id: 'azimuth',
            position: azimuth.menuPosition,
            onClose: () => azimuth.setMenuPosition(null),
            onDeleteLast: azimuth.deleteLastPoint,
            onDeleteAll: azimuth.deleteAll,
            onExportCsv: () => exportAzimuthCsv(cellId),
            disableExport: azimuth.pointCount < 2,
        });
    }
    if (volume.menuPosition) {
        contextMenus.push({
            id: 'volume',
            position: volume.menuPosition,
            onClose: () => volume.setMenuPosition(null),
            onDeleteAll: volume.deleteAll,
            onExportCsv: () => exportVolumeCsv(cellId),
            disableExport: volume.totalVolume === 0,
        });
    }

    const profile: ViewerProfilePanelModel = {
        activeProfileUuid: profileTool.activeProfile?.uuid,
        bins: profileData.bins,
        isMeasuring: isProfileMeasuring,
        isPanelCollapsed: isProfilePanelCollapsed,
        onClose: () => {
            setIsProfilePanelCollapsed(false);
            profileTool.closeProfile();
        },
        onCollapsedChange: setIsProfilePanelCollapsed,
        onDeleteLast: profileTool.deleteLastPoint,
        onExport: () => profileData.exportToCsv(cellId),
        onFinish: profileTool.finishProfile,
        onNewProfile: () => {
            setProfileWidthState(PROFILE_WIDTH_DEFAULTS.default);
            setIsProfilePanelCollapsed(false);
            profileTool.startNewProfile();
        },
        onWidthChange: handleProfileWidthChange,
        phase: profileTool.phase,
        revision: profileData.revision,
        sample: profileData.sample,
        segments: profileData.segments,
        status: profileData.status,
        summary: profileData.summary,
        width: profileWidth,
    };

    const kvrTool: ViewerKvrToolModel = {
        focusRequest: kvr.focusRequest,
        inspectState: kvr.inspectState,
        isInspecting: kvr.isInspecting,
        isPopoverOpen: kvr.isPopoverOpen,
        onClose: kvr.closePopover,
        onRetry: kvr.retryLastInspection,
        onFocusMatch: kvr.requestMatchFocus,
        onToggle: createHandler('kvr', kvr.toggleInspectMode),
    };

    const cursor: ViewerCursorState = {
        isAnnotationPlacing: annotations.isPlacing,
        isKvrInspecting: kvr.isInspecting,
    };

    return {
        contextMenus,
        cursor,
        kvr: kvrTool,
        markers,
        profile,
        toolbar,
    };
}
