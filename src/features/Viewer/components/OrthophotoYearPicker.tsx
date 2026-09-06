import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/common/components';
import type { OrthophotoServiceInfo } from '@/features/Viewer/utils/orthophotoCatalog';
import type { OrthophotoCatalogStatus } from '@/features/Viewer/hooks/useOrthophotoCatalog';
import { ToolPopover } from './ToolPopover';

interface OrthophotoYearPickerProps {
    anchorRef: RefObject<HTMLButtonElement | null>;
    contentRef: RefObject<HTMLDivElement | null>;
    isOpen: boolean;
    onClose: () => void;
    onDisable: () => void;
    onRetry: () => void;
    onSelect: (id: string) => void;
    selectedId: string | null;
    services: OrthophotoServiceInfo[];
    status: OrthophotoCatalogStatus;
}

export function OrthophotoYearPicker({
    anchorRef,
    contentRef,
    isOpen,
    onClose,
    onDisable,
    onRetry,
    onSelect,
    selectedId,
    services,
    status,
}: OrthophotoYearPickerProps) {
    const { t } = useTranslation();

    return (
        <ToolPopover
            anchorRef={anchorRef}
            isOpen={isOpen}
            testId="viewer-orthophoto-picker"
            width={300}
            className="theme-surface flex max-h-[420px] flex-col overflow-hidden rounded-lg border border-white/10 bg-void-black/95 p-3 text-white shadow-2xl shadow-black/40"
        >
            <div ref={contentRef} className="flex min-h-0 flex-col">
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 pb-1.5">
                    <h3 className="text-sm font-bold text-neon-amber">
                        {t('orthophotoCompare.pickerTitle')}
                    </h3>
                    <button
                        type="button"
                        aria-label={t('orthophotoCompare.close')}
                        className="flex size-6 shrink-0 items-center justify-center rounded-md border border-white/10 text-white/60 transition hover:border-neon-amber/50 hover:text-neon-amber"
                        onClick={onClose}
                    >
                        <Icon name="close" size={14} />
                    </button>
                </div>

                <div className="custom-scrollbar min-h-0 overflow-y-auto py-2 pr-1">
                    {status === 'loading' && (
                        <div
                            data-testid="viewer-orthophoto-picker-loading"
                            className="flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.04] p-3"
                            aria-live="polite"
                        >
                            <div className="size-5 shrink-0 animate-spin rounded-full border-2 border-white/15 border-t-neon-amber" />
                            <p className="text-sm leading-5 text-white/75">
                                {t('orthophotoCompare.loading')}
                            </p>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="flex flex-col gap-3 rounded-md border border-plasma-red/30 bg-plasma-red/10 p-3">
                            <div>
                                <p className="text-sm font-semibold leading-5 text-white">
                                    {t('orthophotoCompare.errorTitle')}
                                </p>
                                <p className="mt-1 text-sm leading-5 text-white/65">
                                    {t('orthophotoCompare.errorDescription')}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={onRetry}
                                className="rounded-md border border-neon-amber/50 bg-neon-amber/10 px-3 py-1.5 text-sm font-semibold text-neon-amber transition hover:bg-neon-amber/20"
                            >
                                {t('orthophotoCompare.retry')}
                            </button>
                        </div>
                    )}

                    {status === 'ready' && services.length === 0 && (
                        <p className="rounded-md border border-white/10 bg-white/[0.04] p-3 text-sm leading-5 text-white/65">
                            {t('orthophotoCompare.empty')}
                        </p>
                    )}

                    {status === 'ready' && services.length > 0 && (
                        <div
                            role="radiogroup"
                            aria-label={t('orthophotoCompare.pickerTitle')}
                            className="flex flex-col gap-1"
                        >
                            {services.map((service) => {
                                const selected = service.id === selectedId;
                                return (
                                    <button
                                        key={service.id}
                                        type="button"
                                        role="radio"
                                        aria-checked={selected}
                                        data-testid={`viewer-orthophoto-year-${service.id}`}
                                        onClick={() => onSelect(service.id)}
                                        className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-[13px] leading-5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-amber/50 ${
                                            selected
                                                ? 'border-neon-amber bg-neon-amber/[0.12] font-semibold text-white'
                                                : 'border-transparent text-white/70 hover:border-white/15 hover:bg-white/[0.05] hover:text-white'
                                        }`}
                                    >
                                        <span
                                            aria-hidden="true"
                                            className={`flex size-3.5 shrink-0 items-center justify-center rounded-full border ${
                                                selected ? 'border-neon-amber' : 'border-white/30'
                                            }`}
                                        >
                                            {selected && (
                                                <span className="size-1.5 rounded-full bg-neon-amber" />
                                            )}
                                        </span>
                                        {t('orthophotoCompare.periodYear', {
                                            range: service.rangeLabel,
                                        })}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="shrink-0 border-t border-white/10 pt-2">
                    <button
                        type="button"
                        data-testid="viewer-orthophoto-disable"
                        onClick={onDisable}
                        className="w-full rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm font-semibold text-white/70 transition hover:border-plasma-red/50 hover:text-plasma-red"
                    >
                        {t('orthophotoCompare.disable')}
                    </button>
                </div>
            </div>
        </ToolPopover>
    );
}
