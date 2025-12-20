import { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { GlassPanel } from '@/common/components';

interface MeasurementContextProps {
    x: number;
    y: number;
    onClose: () => void;
    onDeleteLast: () => void;
    onDeleteAll: () => void;
    onExportCsv: () => void;
}

export function MeasurementContext({
    x,
    y,
    onClose,
    onDeleteLast,
    onDeleteAll,
    onExportCsv,
}: MeasurementContextProps) {
    const { t } = useTranslation();
    const menuRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    return (
        <div ref={menuRef} className="fixed z-50 min-w-[160px]" style={{ left: x, top: y }}>
            <GlassPanel className="p-1 !gap-1">
                <button
                    onClick={() => {
                        onDeleteLast();
                        onClose();
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors flex items-center gap-2"
                >
                    <span className="text-neon-cyan">↩️</span> {t('measurement.deleteLast')}
                </button>
                <div className="h-[1px] bg-white/10 my-1" />
                <button
                    onClick={() => {
                        onDeleteAll();
                        onClose();
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors flex items-center gap-2"
                >
                    <span className="text-plasma-red">🗑️</span> {t('measurement.deleteAll')}
                </button>
                <div className="h-[1px] bg-white/10 my-1" />
                <button
                    onClick={() => {
                        onExportCsv();
                        onClose();
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors flex items-center gap-2"
                >
                    <span>📊</span> {t('measurement.exportCsv')}
                </button>
            </GlassPanel>
        </div>
    );
}
