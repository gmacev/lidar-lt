import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/common/components';
import type { StoredAnnotation } from '../utils/annotationStorage';
import { ToolPopover } from './ToolPopover';
import { ToolbarToolButton } from './ToolbarToolButton';

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
    allVisible,
    someVisible,
}: AnnotationToolProps) {
    const { t } = useTranslation();
    const buttonRef = useRef<HTMLButtonElement>(null);

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
                className="flex flex-col gap-2 rounded-lg border border-white/10 bg-glass-bg p-3"
            >
                {/* Header */}
                <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-white/60 uppercase tracking-wide">
                        {t('annotation.annotations')}
                    </span>
                    <button
                        onClick={onTogglePanel}
                        className="flex h-5 w-5 items-center justify-center rounded text-white/40 hover:text-plasma-red hover:bg-plasma-red/10 transition-all"
                        title={t('flood.close')}
                    >
                        <Icon name="close" size={12} strokeWidth={2.5} />
                    </button>
                </div>

                {/* Show All checkbox */}
                {annotations.length > 0 && (
                    <label className="flex items-center gap-2 text-xs text-white/80 hover:bg-white/5 rounded px-1 py-0.5 cursor-pointer select-none border-b border-white/10 pb-2">
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
                )}

                {/* Annotation list */}
                {annotations.length === 0 ? (
                    <div className="text-xs text-white/40 text-center py-4">
                        {t('annotation.noAnnotations')}
                    </div>
                ) : (
                    <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto custom-scrollbar">
                        {annotations.map((ann) => (
                            <div
                                key={ann.id}
                                className="flex items-center gap-1.5 group hover:bg-white/5 rounded px-1 py-0.5"
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
                                    className="text-xs text-white/80 truncate flex-1 cursor-pointer hover:text-neon-cyan"
                                    onClick={() => onNavigate(ann.id)}
                                    title={ann.title}
                                >
                                    {ann.title}
                                </span>

                                {/* Delete button - always visible */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete(ann.id);
                                    }}
                                    className="flex h-5 w-5 items-center justify-center rounded text-white/30 hover:text-plasma-red hover:bg-plasma-red/10 transition-all flex-shrink-0"
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
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium text-neon-cyan border border-neon-cyan/30 bg-neon-cyan/10 hover:bg-neon-cyan/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <Icon name="plus" size={12} />
                        {t('annotation.addAnnotation')}
                    </button>

                    {annotations.length > 0 && (
                        <button
                            onClick={handleDeleteAll}
                            className="flex items-center gap-1 px-2 py-1.5 rounded text-xs text-white/50 hover:text-plasma-red hover:bg-plasma-red/10 transition-all"
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
