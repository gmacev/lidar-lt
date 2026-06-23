import type { RefObject } from 'react';
import type { PotreeLoadError } from '@/features/Viewer/hooks/usePotree';
import type { PotreeViewer } from '@/common/types/potree';
import { HeightProfilePanel } from './HeightProfilePanel';
import type { ViewerProfilePanelModel } from '@/features/Viewer/hooks/useViewerTools';

interface ViewerProfilePanelProps {
    error: PotreeLoadError | null;
    isLoading: boolean;
    isSidebarCollapsed: boolean;
    profile: ViewerProfilePanelModel;
    uiVisible: boolean;
    viewerRef: RefObject<PotreeViewer | null>;
}

export function ViewerProfilePanel({
    error,
    isLoading,
    isSidebarCollapsed,
    profile,
    uiVisible,
    viewerRef,
}: ViewerProfilePanelProps) {
    if (!profile.isMeasuring || isLoading || error) return null;

    return (
        <HeightProfilePanel
            key={profile.activeProfileUuid}
            viewerRef={viewerRef}
            phase={profile.phase}
            sample={profile.sample}
            bins={profile.bins}
            segments={profile.segments}
            status={profile.status}
            summary={profile.summary}
            revision={profile.revision}
            width={profile.width}
            onWidthChange={profile.onWidthChange}
            onFinish={profile.onFinish}
            onNewProfile={profile.onNewProfile}
            onDeleteLast={profile.onDeleteLast}
            onExport={profile.onExport}
            onClose={profile.onClose}
            onCollapsedChange={profile.onCollapsedChange}
            sidebarVisible={uiVisible && !isSidebarCollapsed}
        />
    );
}
