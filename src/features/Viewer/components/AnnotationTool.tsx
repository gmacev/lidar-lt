import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/common/components';
import type { StoredAnnotation } from '../utils/annotationStorage';
import { ToolPopover } from './ToolPopover';
import { ToolbarToolButton } from './ToolbarToolButton';

const ACTION_BUTTON_CLASS =
    'theme-tool-muted-button flex size-6 shrink-0 items-center justify-center rounded transition-colors focus-visible:outline-none focus-visible:ring-2';

interface AnnotationToolProps {
    annotations: StoredAnnotation[];
    isPanelOpen: boolean;
    onTogglePanel: () => void;
    isPlacing: boolean;
    onStartPlacement: () => void;
    onToggleVisibility: (id: string) => void;
    onToggleAllVisibility: () => void;
    onNavigate: (id: string) => void;
    onDelete: (id: string) => void;
    onDeleteAll: () => void;
    onExport: () => void;
    onImport: (file: File) => Promise<void>;
    allVisible: boolean;
    someVisible: boolean;
}

/**
 * Annotation tool with floating panel
 */
export function AnnotationTool({
    annotations,
    isPanelOpen,
    onTogglePanel,
    isPlacing,
    onStartPlacement,
    onToggleVisibility,
    onToggleAllVisibility,
    onNavigate,
    onDelete,
    onDeleteAll,
    onExport,
    onImport,
    allVisible,
    someVisible,
}: AnnotationToolProps) {
    const { t } = useTranslation();
    const buttonRef = useRef<HTMLButtonElement>(null);
    const importInputRef = useRef<HTMLInputElement>(null);

    const isIndeterminate = someVisible && !allVisible;

    const handleDeleteAll = () => {
        if (window.confirm(t('annotation.deleteAllConfirm'))) {
            onDeleteAll();
        }
    };

    return (
        <div className="relative flex items-center justify-end">
            <ToolPopover
                anchorRef={buttonRef}
                isOpen={isPanelOpen}
                testId="viewer-annotation-popover"
                width={280}
                className="theme-surface theme-tool-popup flex flex-col gap-2 rounded-lg border border-white/10 bg-glass-bg p-3"
            >
                {/* Header */}
                <div className="flex items-center justify-between">
                    <span className="theme-tool-heading text-xs font-medium text-white/60 uppercase tracking-wide">
                        {t('annotation.annotations')}
                    </span>
                    <button
                        type="button"
                        data-testid="viewer-annotation-close"
                        onClick={onTogglePanel}
                        className={`${ACTION_BUTTON_CLASS} text-white/40 hover:bg-plasma-red/10 hover:text-plasma-red focus-visible:ring-plasma-red/60`}
                        title={t('flood.close')}
                    >
                        <Icon name="close" size={12} strokeWidth={2.5} />
                    </button>
                </div>

                {/* Visibility and export controls */}
                <div className="flex min-h-7 items-center justify-between gap-2 border-b border-white/10 pb-2">
                    {annotations.length > 0 ? (
                        <label className="theme-tool-body theme-tool-row flex cursor-pointer select-none items-center gap-2 rounded px-1 py-0.5 text-xs text-white/80 hover:bg-white/5">
                            <input
                                type="checkbox"
                                checked={allVisible}
                                ref={(input) => {
                                    if (input) input.indeterminate = isIndeterminate;
                                }}
                                onChange={onToggleAllVisibility}
                                className="accent-neon-cyan cursor-pointer"
                            />
                            <span className="font-medium">{t('annotation.showAll')}</span>
                        </label>
                    ) : (
                        <span />
                    )}
                    <div className="flex items-center">
                        <input
                            ref={importInputRef}
                            type="file"
                            data-testid="viewer-annotation-import-input"
                            accept=".geojson,application/geo+json,application/json"
                            className="sr-only"
                            onChange={(event) => {
                                const file = event.currentTarget.files?.[0];
                                event.currentTarget.value = '';
                                if (file) void onImport(file);
                            }}
                        />
                        <button
                            type="button"
                            data-testid="viewer-annotation-import"
                            aria-label={t('annotation.importGeoJson')}
                            title={t('annotation.importGeoJson')}
                            onClick={() => importInputRef.current?.click()}
                            className={`${ACTION_BUTTON_CLASS} text-white/45 hover:bg-white/5 hover:text-neon-cyan focus-visible:ring-neon-cyan/60`}
                        >
                            <Icon name="upload" size={12} aria-hidden="true" />
                        </button>
                        <button
                            type="button"
                            data-testid="viewer-annotation-export"
                            aria-label={t('annotation.exportGeoJson')}
                            title={t('annotation.exportGeoJson')}
                            onClick={onExport}
                            disabled={annotations.length === 0}
                            className={`${ACTION_BUTTON_CLASS} text-white/45 hover:bg-white/5 hover:text-neon-cyan focus-visible:ring-neon-cyan/60 disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-white/45`}
                        >
                            <Icon name="download" size={12} aria-hidden="true" />
                        </button>
                    </div>
                </div>

                {/* Annotation list */}
                {annotations.length === 0 ? (
                    <div className="theme-tool-secondary text-xs text-white/40 text-center py-4">
                        {t('annotation.noAnnotations')}
                    </div>
                ) : (
                    <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto custom-scrollbar">
                        {annotations.map((ann) => (
                            <div
                                key={ann.id}
                                className="theme-tool-row flex items-center gap-1.5 group hover:bg-white/5 rounded px-1 py-0.5"
                            >
                                {/* Visibility checkbox */}
                                <input
                                    type="checkbox"
                                    checked={ann.visible}
                                    onChange={() => onToggleVisibility(ann.id)}
                                    className="accent-neon-cyan cursor-pointer flex-shrink-0"
                                />

                                {/* Title */}
                                <span
                                    className="theme-tool-body text-xs text-white/80 truncate flex-1 cursor-pointer hover:text-neon-cyan"
                                    onClick={() => onNavigate(ann.id)}
                                    title={ann.title}
                                >
                                    {ann.title}
                                </span>

                                {/* Delete button - always visible */}
                                <button
                                    type="button"
                                    data-testid={`viewer-annotation-delete-${ann.id}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete(ann.id);
                                    }}
                                    className={`${ACTION_BUTTON_CLASS} translate-x-1 text-white/30 hover:bg-plasma-red/10 hover:text-plasma-red focus-visible:ring-plasma-red/60`}
                                    title={t('annotation.delete')}
                                >
                                    <Icon name="trash" size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Action buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                    <button
                        data-testid="viewer-annotation-start-placement"
                        onClick={onStartPlacement}
                        disabled={isPlacing}
                        className="theme-annotation-primary flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium text-neon-cyan border border-neon-cyan/30 bg-neon-cyan/10 hover:bg-neon-cyan/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <Icon name="plus" size={12} />
                        {t('annotation.addAnnotation')}
                    </button>

                    {annotations.length > 0 && (
                        <button
                            onClick={handleDeleteAll}
                            className="theme-tool-secondary flex items-center gap-1 px-2 py-1.5 rounded text-xs text-white/50 hover:text-plasma-red hover:bg-plasma-red/10 transition-all"
                        >
                            <Icon name="trash" size={12} />
                            {t('annotation.deleteAll')}
                        </button>
                    )}
                </div>
            </ToolPopover>

            {/* Main button */}
            <ToolbarToolButton
                ref={buttonRef}
                data-testid="viewer-tool-annotations"
                onClick={onTogglePanel}
                isActive={isPanelOpen || isPlacing}
                label={t('annotation.annotations')}
                icon={<Icon name="messageSquare" size={20} />}
            />
        </div>
    );
}
