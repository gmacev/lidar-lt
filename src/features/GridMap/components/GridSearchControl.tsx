import { useTranslation } from 'react-i18next';
import { GlassPanel } from '@/common/components/GlassPanel';

interface GridSearchControlProps {
    value: string;
    onChange: (value: string) => void;
    matchedCount?: number;
    totalCount?: number;
    searchStatus: 'idle' | 'loading' | 'success' | 'error';
}

export function GridSearchControl({
    value,
    onChange,
    matchedCount = 0,
    totalCount = 0,
    searchStatus,
}: GridSearchControlProps) {
    const { t } = useTranslation();

    return (
        <div className="absolute left-2 right-20 top-2 z-10 sm:left-4 sm:right-auto sm:top-4 sm:w-80">
            <GlassPanel variant="themed" className="flex flex-col gap-2">
                <div className="relative">
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={t('search.gridPlaceholder')}
                        aria-label={t('search.gridSearchLabel')}
                        className="w-full rounded border border-theme-brand/30 bg-panel-input px-3 py-1.5 pr-8 text-sm text-panel-text placeholder:text-panel-subtle transition-colors focus:border-theme-brand focus:outline-none focus:ring-1 focus:ring-theme-brand/30"
                    />
                    {value && (
                        <button
                            type="button"
                            onClick={() => onChange('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-panel-muted hover:text-panel-text"
                            aria-label={t('search.clearSearch')}
                        >
                            ✕
                        </button>
                    )}
                </div>

                {searchStatus === 'error' && (
                    <div className="rounded border border-red-500/35 bg-red-500/10 px-2.5 py-2 text-xs text-red-700 dark:text-red-300" role="alert">
                        {t('search.geographicSearchError')}
                    </div>
                )}

                <div className="flex justify-between px-1 text-xs">
                    <div className="text-panel-muted">{t('search.example')}</div>
                    {value && (
                        <div className="text-theme-brand" role="status">
                            {searchStatus === 'loading'
                                ? t('search.searching')
                                : `${t('search.found')}: ${matchedCount} / ${totalCount}`}
                        </div>
                    )}
                </div>
            </GlassPanel>
        </div>
    );
}
