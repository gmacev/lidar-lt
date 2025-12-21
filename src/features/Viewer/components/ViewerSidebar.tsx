import { useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { PotreeViewer } from '@/common/types/potree';
import type { ViewerState, Projection } from '@/features/Viewer/config/viewerConfig';
import { GlassPanel, Icon } from '@/common/components';
import { SidebarSection } from './SidebarSection';
import { ColorModeControl } from './ColorModeControl';
import { BackgroundControl } from './BackgroundControl';
import { ClassificationControl } from './ClassificationControl';
import { EDLControl } from './EDLControl';
import { PointCloudSettings } from './PointCloudSettings';
import { CameraProjectionControl } from './CameraProjectionControl';
import { FOVControl } from './FOVControl';

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
    const [projection, setProjection] = useState<Projection>(
        initialState.projection ?? 'PERSPECTIVE'
    );

    return (
        <GlassPanel className="w-72 max-h-[calc(100vh-8rem)] overflow-y-auto">
            <div className="flex flex-col">
                {/* Visualization Section */}
                <SidebarSection
                    title={t('sidebar.visualization')}
                    icon={<Icon name="palette" size={16} />}
                >
                    <div className="flex flex-col gap-3">
                        <ColorModeControl
                            viewerRef={viewerRef}
                            initialState={initialState}
                            updateUrl={updateUrl}
                        />

                        <BackgroundControl
                            viewerRef={viewerRef}
                            initialState={initialState}
                            updateUrl={updateUrl}
                        />

                        <div className="h-px bg-white/10 my-1" />

                        <CameraProjectionControl
                            viewerRef={viewerRef}
                            projection={projection}
                            onChange={setProjection}
                        />

                        <FOVControl
                            viewerRef={viewerRef}
                            initialState={initialState}
                            updateUrl={updateUrl}
                            disabled={projection === 'ORTHOGRAPHIC'}
                        />
                    </div>
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
                            <PointCloudSettings
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
