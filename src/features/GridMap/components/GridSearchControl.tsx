import { useTranslation } from 'react-i18next';
import { GlassPanel } from '@/common/components/GlassPanel';

interface GridSearchControlProps {
    value: string;
    onChange: (value: string) => void;
    matchedCount?: number;
    totalCount?: number;
}

export function GridSearchControl({
    value,
    onChange,
    matchedCount = 0,
    totalCount = 0,
}: GridSearchControlProps) {
    const { t } = useTranslation();

    return (
        <div className="absolute left-2 right-20 top-2 z-10 sm:left-4 sm:right-auto sm:top-4 sm:w-80">
            <GlassPanel className="flex flex-col gap-2">
                <div className="relative">
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={t('search.gridPlaceholder')}
                        className="w-full rounded border border-neon-cyan/30 bg-black/60 px-3 py-1.5 text-sm text-neon-cyan placeholder-gray-500 transition-colors focus:border-neon-cyan focus:outline-none focus:ring-1 focus:ring-neon-cyan"
                    />
                    {value && (
                        <button
                            onClick={() => onChange('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                            aria-label={t('search.clearSearch')}
                        >
                            ✕
                        </button>
                    )}
                </div>

                <div className="flex justify-between px-1 text-xs">
                    <div className="text-gray-400">{t('search.example')}</div>
                    {value && (
                        <div className="text-neon-cyan">
                            {t('search.found')}: {matchedCount} / {totalCount}
                        </div>
                    )}
                </div>
            </GlassPanel>
        </div>
    );
}
