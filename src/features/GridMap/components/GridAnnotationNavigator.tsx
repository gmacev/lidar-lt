import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Icon, toast } from '@/common/components';
import {
    getAllStoredAnnotations,
    getAnnotationCameraState,
    mergeStoredAnnotations,
    type AnnotationCameraState,
    type StoredSectorAnnotation,
} from '@/features/Viewer/utils/annotationStorage';
import {
    downloadAnnotationGeoJson,
    readAnnotationGeoJson,
} from '@/features/Viewer/utils/annotationGeoJson';

interface GridAnnotationNavigatorProps {
    validSectorIds: ReadonlySet<string>;
    onHighlightedSectorChange: (sectorId: string | null) => void;
}

interface NavigableStoredAnnotation extends StoredSectorAnnotation {
    cameraState: AnnotationCameraState;
}

export function GridAnnotationNavigator({
    validSectorIds,
    onHighlightedSectorChange,
}: GridAnnotationNavigatorProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const panelId = useId();
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const importInputRef = useRef<HTMLInputElement>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [storedAnnotations, setStoredAnnotations] = useState<StoredSectorAnnotation[]>(() =>
        getAllStoredAnnotations().filter(({ sectorId }) => validSectorIds.has(sectorId))
    );
    const annotations = storedAnnotations.flatMap<NavigableStoredAnnotation>((storedAnnotation) => {
        const cameraState = getAnnotationCameraState(storedAnnotation.annotation);
        return cameraState ? [{ ...storedAnnotation, cameraState }] : [];
    });

    useEffect(() => {
        if (!isOpen) return;

        const handlePointerDown = (event: PointerEvent) => {
            if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
                setIsOpen(false);
                onHighlightedSectorChange(null);
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            setIsOpen(false);
            onHighlightedSectorChange(null);
            triggerRef.current?.focus();
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onHighlightedSectorChange]);

    const openAnnotation = ({ sectorId, cameraState }: NavigableStoredAnnotation) => {
        setIsOpen(false);
        onHighlightedSectorChange(null);
        void navigate({
            to: '/viewer/$cellId',
            params: { cellId: sectorId },
            search: cameraState,
        });
    };

    const handleImport = async (file: File) => {
        try {
            const imported = await readAnnotationGeoJson(file);
            if (imported.some(({ sectorId }) => !validSectorIds.has(sectorId))) {
                toast.error(t('annotation.importFailed'), {
                    description: t('annotation.importInvalidSector'),
                });
                return;
            }

            const result = mergeStoredAnnotations(imported);
            setStoredAnnotations(
                getAllStoredAnnotations().filter(({ sectorId }) => validSectorIds.has(sectorId))
            );
            toast.success(t('annotation.imported'), {
                description: t('annotation.importedCount', { count: result.importedCount }),
            });
        } catch {
            toast.error(t('annotation.importFailed'), {
                description: t('annotation.importInvalidFile'),
            });
        }
    };

    const importInput = (
        <input
            ref={importInputRef}
            type="file"
            data-testid="grid-annotation-import-input"
            accept=".geojson,application/geo+json,application/json"
            className="sr-only"
            onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = '';
                if (file) void handleImport(file);
            }}
        />
    );

    return (
        <div ref={rootRef} className="relative flex flex-col items-end">
            {importInput}
            <button
                ref={triggerRef}
                type="button"
                data-testid="grid-annotation-trigger"
                aria-controls={panelId}
                aria-expanded={isOpen}
                onClick={() => {
                    if (isOpen) onHighlightedSectorChange(null);
                    setIsOpen((current) => !current);
                }}
                className="flex min-h-8 items-center gap-2 rounded-lg border border-panel-border bg-panel-bg px-2.5 py-1.5 text-xs font-medium text-panel-text shadow-lg transition-colors hover:border-theme-brand/55 hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-brand/70 motion-reduce:transition-none"
            >
                <Icon
                    name="mapPin"
                    size={15}
                    fill="currentColor"
                    stroke="none"
                    className="shrink-0 text-theme-brand"
                    data-testid="grid-annotation-pin"
                    aria-hidden="true"
                />
                <span>{t('annotation.myAnnotations')}</span>
                <span className="min-w-5 rounded-full bg-theme-brand px-1.5 py-0.5 text-center text-[11px] font-bold leading-4 text-black">
                    {annotations.length}
                </span>
                <Icon
                    name={isOpen ? 'chevronUp' : 'chevronDown'}
                    size={14}
                    className="text-panel-muted"
                    aria-hidden="true"
                />
            </button>

            {isOpen && (
                <section
                    id={panelId}
                    data-testid="grid-annotation-panel"
                    aria-label={t('annotation.myAnnotations')}
                    className="absolute right-0 top-[calc(100%+0.5rem)] w-72 max-w-[calc(100vw-1rem)] overflow-hidden rounded-lg border border-panel-border bg-panel-bg text-panel-text shadow-2xl"
                >
                    <div className="flex min-h-10 items-center justify-between gap-3 border-b border-panel-border px-3 py-1.5">
                        <span className="text-sm font-semibold">
                            {t('annotation.myAnnotations')}
                        </span>
                        <div className="flex translate-x-1.5 items-center">
                            <button
                                type="button"
                                data-testid="grid-annotation-import"
                                aria-label={t('annotation.importGeoJson')}
                                title={t('annotation.importGeoJson')}
                                onClick={() => importInputRef.current?.click()}
                                className="flex size-7 shrink-0 items-center justify-center rounded text-panel-muted transition-colors hover:bg-panel-hover hover:text-theme-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-brand/70 motion-reduce:transition-none"
                            >
                                <Icon name="upload" size={16} aria-hidden="true" />
                            </button>
                            <button
                                type="button"
                                data-testid="grid-annotation-export"
                                aria-label={t('annotation.exportGeoJson')}
                                title={t('annotation.exportGeoJson')}
                                onClick={() => downloadAnnotationGeoJson(storedAnnotations)}
                                disabled={storedAnnotations.length === 0}
                                className="flex size-7 shrink-0 items-center justify-center rounded text-panel-muted transition-colors hover:bg-panel-hover hover:text-theme-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-brand/70 disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-panel-muted motion-reduce:transition-none"
                            >
                                <Icon name="download" size={16} aria-hidden="true" />
                            </button>
                        </div>
                    </div>

                    <ul className="max-h-80 divide-y divide-panel-border overflow-y-auto">
                        {annotations.length === 0 ? (
                            <li className="px-3 py-4 text-center text-xs text-panel-muted">
                                {t('annotation.noAnnotations')}
                            </li>
                        ) : (
                            annotations.map((storedAnnotation) => (
                                <li
                                    key={`${storedAnnotation.sectorId}:${storedAnnotation.annotation.id}`}
                                >
                                    <button
                                        type="button"
                                        data-testid={`grid-annotation-${storedAnnotation.annotation.id}`}
                                        aria-label={t('annotation.openFromGrid', {
                                            title: storedAnnotation.annotation.title,
                                            sectorId: storedAnnotation.sectorId,
                                        })}
                                        onPointerEnter={() =>
                                            onHighlightedSectorChange(storedAnnotation.sectorId)
                                        }
                                        onPointerLeave={() => onHighlightedSectorChange(null)}
                                        onFocus={() =>
                                            onHighlightedSectorChange(storedAnnotation.sectorId)
                                        }
                                        onBlur={() => onHighlightedSectorChange(null)}
                                        onClick={() => openAnnotation(storedAnnotation)}
                                        className="group flex min-h-10 w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors hover:bg-panel-hover focus-visible:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-theme-brand/70 motion-reduce:transition-none"
                                    >
                                        <Icon
                                            name="mapPin"
                                            size={16}
                                            fill="currentColor"
                                            stroke="none"
                                            className="shrink-0 text-theme-brand"
                                            aria-hidden="true"
                                        />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium">
                                                {storedAnnotation.annotation.title}
                                            </span>
                                            <span className="block font-mono text-[11px] text-panel-muted">
                                                {storedAnnotation.sectorId}
                                            </span>
                                        </span>
                                        <Icon
                                            name="chevronRight"
                                            size={16}
                                            data-testid={`grid-annotation-chevron-${storedAnnotation.annotation.id}`}
                                            className="shrink-0 text-panel-muted transition-colors group-hover:text-theme-brand motion-reduce:transition-none"
                                            aria-hidden="true"
                                        />
                                    </button>
                                </li>
                            ))
                        )}
                    </ul>
                </section>
            )}
        </div>
    );
}
