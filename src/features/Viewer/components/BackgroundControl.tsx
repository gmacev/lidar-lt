import type { JSX } from 'react';
import type { PotreeViewer } from '@/common/types/potree';
import type { ViewerState, Background, SkyboxVariant } from '@/features/Viewer/config/viewerConfig';
import { useTranslation } from 'react-i18next';

interface BackgroundControlProps {
    viewerRef: React.RefObject<PotreeViewer | null>;
    initialState: ViewerState;
    updateUrl: (state: Partial<ViewerState>) => void;
}

export function BackgroundControl({
    viewerRef,
    initialState,
    updateUrl,
}: BackgroundControlProps): JSX.Element {
    const { t } = useTranslation();

    // Determine current active background
    const currentBackground: Background = initialState.bg ?? 'gradient';
    const currentSkybox: SkyboxVariant = initialState.sb ?? '1';

    const handleBackgroundChange = (newBg: Background) => {
        // If switching to skybox and no variant is set, default to '1'
        const updates: Partial<ViewerState> = { bg: newBg };
        if (newBg === 'skybox' && !initialState.sb) {
            updates.sb = '1';
        }
        updateUrl(updates);

        if (viewerRef.current) {
            viewerRef.current.setBackground(newBg);
        }
    };

    const handleSkyboxVariantChange = (variant: SkyboxVariant) => {
        updateUrl({ sb: variant });
    };

    const buttonClass = (isActive: boolean) =>
        `flex-1 py-1.5 text-[11px] font-medium transition-all text-center ${
            isActive
                ? 'bg-laser-green/20 text-laser-green border-laser-green'
                : 'text-white/60 hover:text-white/80 border-white/20 hover:border-white/40 hover:bg-white/5'
        } border rounded`;

    return (
        <div className="flex flex-col gap-2">
            <span className="text-xs text-white/70">{t('viewer.background')}</span>

            {/* Background Mode Selector */}
            <div className="flex gap-1">
                {(['gradient', 'black', 'skybox'] as const).map((mode) => (
                    <button
                        key={mode}
                        onClick={() => handleBackgroundChange(mode)}
                        className={buttonClass(currentBackground === mode)}
                    >
                        {t(`viewer.bg.${mode}`, { defaultValue: mode })}
                    </button>
                ))}
            </div>

            {/* Skybox Variant Selector - Only visible when Skybox is active */}
            {currentBackground === 'skybox' && (
                <div className="flex flex-col gap-1 mt-1">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-white/70">{t('viewer.variant')}</span>
                        <div className="flex gap-1">
                            {(['1', '2'] as const).map((variant) => (
                                <button
                                    key={variant}
                                    onClick={() => handleSkyboxVariantChange(variant)}
                                    className={`px-3 py-1 text-[10px] border rounded transition-colors ${
                                        currentSkybox === variant
                                            ? 'bg-laser-green/20 text-laser-green border-laser-green'
                                            : 'text-white/60 hover:text-white/80 border-white/20 hover:border-white/40 hover:bg-white/5'
                                    }`}
                                >
                                    {variant}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
