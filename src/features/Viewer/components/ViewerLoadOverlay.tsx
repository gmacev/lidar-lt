import { useTranslation } from 'react-i18next';
import { DataLoader, GlassPanel, Icon, NeonButton } from '@/common/components';
import type { PotreeLoadError } from '@/features/Viewer/hooks/usePotree';

interface ViewerLoadOverlayProps {
    error: PotreeLoadError | null;
    isLoading: boolean;
    onBack: () => void;
    sectorLabel: string;
}

export function ViewerLoadOverlay({
    error,
    isLoading,
    onBack,
    sectorLabel,
}: ViewerLoadOverlayProps) {
    const { t } = useTranslation();
    const errorCopy =
        error?.code === 'metadata-not-found'
            ? {
                  title: t('viewer.loadError.metadataNotFoundTitle'),
                  message: t('viewer.loadError.metadataNotFoundMessage', {
                      sector: sectorLabel,
                  }),
              }
            : error
              ? {
                    title: t('viewer.loadError.unavailableTitle'),
                    message: t('viewer.loadError.unavailableMessage'),
                }
              : null;

    if (isLoading) {
        return (
            <div
                data-testid="viewer-loading-overlay"
                className="absolute inset-0 flex items-center justify-center bg-void-black/90"
            >
                <DataLoader message={t('viewer.loading')} />
            </div>
        );
    }

    if (!error) return null;

    return (
        <div
            data-testid="viewer-error-overlay"
            className="absolute inset-0 flex items-center justify-center bg-void-black/90"
        >
            <GlassPanel
                className="mx-4 flex max-w-lg flex-col items-center gap-4 p-5 text-center"
                role="status"
            >
                <div className="flex size-12 items-center justify-center rounded-full border border-neon-amber/40 bg-neon-amber/10 text-neon-amber">
                    <Icon name="warningTriangle" size={24} />
                </div>
                <div className="space-y-2">
                    <h2 className="text-lg font-bold text-white">
                        {errorCopy?.title ?? t('viewer.error')}
                    </h2>
                    <p className="text-sm leading-6 text-white/70">{errorCopy?.message}</p>
                </div>
                <dl className="grid w-full grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md border border-white/10 bg-black/30 p-3 text-left text-xs">
                    <dt className="text-white/40">{t('viewer.loadError.sector')}</dt>
                    <dd className="min-w-0 truncate text-white/75">{sectorLabel}</dd>
                    <dt className="text-white/40">{t('viewer.loadError.details')}</dt>
                    <dd className="min-w-0 truncate font-mono text-white/60">
                        {error.status
                            ? t('viewer.loadError.httpStatus', { status: error.status })
                            : error.message}
                    </dd>
                </dl>
                <NeonButton
                    data-testid="viewer-error-back"
                    variant="amber"
                    onClick={onBack}
                    className="px-4 py-2"
                >
                    {t('viewer.loadError.backToMap')}
                </NeonButton>
            </GlassPanel>
        </div>
    );
}
