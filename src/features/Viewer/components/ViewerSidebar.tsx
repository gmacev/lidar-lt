import { useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { PotreeViewer } from '@/common/types/potree';
import type { ViewerState, Projection } from '@/features/Viewer/config/viewerConfig';
import { Icon } from '@/common/components';
import { SidebarSection } from './SidebarSection';
import { ColorModeControl } from './ColorModeControl';
// import { BackgroundControl } from './BackgroundControl'; // Disabled - not useful
import { ClassificationControl } from './ClassificationControl';
import { EDLControl } from './EDLControl';
import { PointCloudSettings } from './PointCloudSettings';
import { CameraProjectionControl } from './CameraProjectionControl';
import { FOVControl } from './FOVControl';

interface ViewerSidebarProps {
    viewerRef: RefObject<PotreeViewer | null>;
    initialState: ViewerState;
    updateUrl: (state: Partial<ViewerState>) => void;
    onBack: () => void;
}

/**
 * Unified floating sidebar containing all viewer controls.
 * Positioned on the left side with collapsible sections.
 */
export function ViewerSidebar({ viewerRef, initialState, updateUrl, onBack }: ViewerSidebarProps) {
    const { t } = useTranslation();
    // Start collapsed on small screens (< 640px / sm breakpoint)
    const [isCollapsed, setIsCollapsed] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.innerWidth < 640;
    });
    const [projection, setProjection] = useState<Projection>(
        initialState.projection ?? 'PERSPECTIVE'
    );

    return (
        <div
            className={`fixed left-0 top-0 z-50 flex h-full transition-all duration-300 ${
                isCollapsed ? '-translate-x-full' : 'translate-x-0'
            }`}
        >
            <div className="flex w-80 flex-col border-r border-white/10 bg-glass-bg backdrop-blur-xl">
                <div className="flex border-b border-white/10 px-4 py-2 bg-white/[0.02]">
                    <button
                        onClick={onBack}
                        className="group flex items-center gap-3 text-[11px] font-bold uppercase tracking-widest text-white/40 transition-all hover:text-neon-amber"
                    >
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 transition-all group-hover:border-neon-amber/30 group-hover:bg-neon-amber/10">
                            <Icon
                                name="arrowLeft"
                                size={14}
                                className="transition-transform group-hover:scale-110"
                            />
                        </div>
                        {t('viewer.back')}
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 custom-scrollbar">
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

                                {/* BackgroundControl disabled - not useful, takes sidebar space
                                <BackgroundControl
                                    viewerRef={viewerRef}
                                    initialState={initialState}
                                    updateUrl={updateUrl}
                                />

                                <div className="h-px bg-white/10 my-1" />
                                */}

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
                </div>
            </div>

            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className={`absolute -right-4 top-1/2 flex h-24 w-4 -translate-y-1/2 items-center justify-center rounded-r-xl border-y border-r border-white/10 bg-glass-bg backdrop-blur-2xl transition-all duration-300 hover:w-6 hover:bg-white/10 group ${
                    isCollapsed ? 'opacity-100 shadow-[4px_0_15px_rgba(0,0,0,0.5)]' : 'opacity-80'
                }`}
                aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
                <div className="flex flex-col items-center gap-0.5">
                    <div className="h-4 w-0.5 rounded-full bg-white/10 transition-colors group-hover:bg-neon-cyan/30" />
                    <Icon
                        name={isCollapsed ? 'chevronRight' : 'chevronLeft'}
                        size={12}
                        className={`text-white/30 transition-all duration-300 group-hover:text-neon-cyan ${
                            isCollapsed ? 'translate-x-0.5' : ''
                        }`}
                    />
                    <div className="h-4 w-0.5 rounded-full bg-white/10 transition-colors group-hover:bg-neon-cyan/30" />
                </div>
            </button>
        </div>
    );
}
