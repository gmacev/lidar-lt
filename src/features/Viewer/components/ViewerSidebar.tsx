import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { PotreeViewer } from '@/common/types/potree';
import type { ViewerState } from '@/features/Viewer/config/viewerConfig';
import { GlassPanel, Icon } from '@/common/components';
import { SidebarSection } from './SidebarSection';
import { ColorModeControl } from './ColorModeControl';
import { ClassificationControl } from './ClassificationControl';
import { EDLControl } from './EDLControl';
import { PointCloudQualityControl } from './PointCloudQualityControl';

interface ViewerSidebarProps {
    viewerRef: RefObject<PotreeViewer | null>;
    initialState: ViewerState;
    updateUrl: (state: Partial<ViewerState>) => void;
}

/**
 * Unified floating sidebar containing all viewer controls.
 * Positioned on the left side with collapsible sections.
 */
export function ViewerSidebar({ viewerRef, initialState, updateUrl }: ViewerSidebarProps) {
    const { t } = useTranslation();

    return (
        <GlassPanel className="w-72 max-h-[calc(100vh-8rem)] overflow-y-auto custom-scrollbar">
            <div className="flex flex-col">
                {/* Visualization Section */}
                <SidebarSection
                    title={t('sidebar.visualization')}
                    icon={<Icon name="palette" size={16} />}
                >
                    <ColorModeControl
                        viewerRef={viewerRef}
                        initialState={initialState}
                        updateUrl={updateUrl}
                    />
                </SidebarSection>

                {/* Classifications Section */}
                <SidebarSection
                    title={t('sidebar.classifications')}
                    icon={<Icon name="tag" size={16} />}
                >
                    <ClassificationControl
                        viewerRef={viewerRef}
                        initialState={initialState}
                        updateUrl={updateUrl}
                    />
                </SidebarSection>

                {/* Rendering Section */}
                <SidebarSection
                    title={t('sidebar.rendering')}
                    icon={<Icon name="sparkles" size={16} />}
                >
                    <div className="flex flex-col gap-3">
                        <EDLControl
                            viewerRef={viewerRef}
                            initialState={initialState}
                            updateUrl={updateUrl}
                        />
                        <div className="border-t border-white/10 pt-3">
                            <PointCloudQualityControl
                                viewerRef={viewerRef}
                                initialState={initialState}
                                updateUrl={updateUrl}
                            />
                        </div>
                    </div>
                </SidebarSection>
            </div>
        </GlassPanel>
    );
}
