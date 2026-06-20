import { useId, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon, toast } from '@/common/components';
import { useViewerPresets } from '@/features/Viewer/hooks/useViewerPresets';
import type { ViewerState } from '@/features/Viewer/config/viewerConfig';
import { pickViewerDisplaySettings } from '@/features/Viewer/utils/viewerDisplaySettings';
import type {
    ViewerPreset,
    ViewerPresetMutationError,
} from '@/features/Viewer/utils/viewerPresetStorage';

interface ViewerPresetManagerProps {
    currentState: ViewerState;
    onLoadPreset: (preset: ViewerPreset) => void;
}

const PRESET_ERROR_KEYS: Record<ViewerPresetMutationError, string> = {
    'empty-name': 'presets.errors.emptyName',
    'name-too-long': 'presets.errors.nameTooLong',
    'duplicate-name': 'presets.errors.duplicateName',
    'limit-reached': 'presets.errors.limitReached',
    'not-found': 'presets.errors.notFound',
};

const inputClassName =
    'min-w-0 flex-1 rounded border border-white/10 bg-black/25 px-2 py-1.5 text-xs text-white placeholder:text-white/30 outline-none transition-colors focus:border-neon-amber/60 focus:bg-black/45';

const primaryButtonClassName =
    'inline-flex items-center justify-center gap-1 rounded border border-laser-green/35 bg-laser-green/10 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-laser-green transition-colors hover:border-laser-green/65 hover:bg-laser-green/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-laser-green/60';

const secondaryButtonClassName =
    'rounded border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/55 transition-colors hover:border-white/25 hover:bg-white/8 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45';

const confirmUpdateButtonClassName =
    'rounded border border-laser-green/35 bg-laser-green/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-laser-green transition-colors hover:border-laser-green/65 hover:bg-laser-green/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-laser-green/60';

const dangerButtonClassName =
    'rounded border border-plasma-red/30 bg-plasma-red/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-plasma-red transition-colors hover:border-plasma-red/60 hover:bg-plasma-red/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plasma-red/55';

function formatPresetDate(value: string): string | null {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

export function ViewerPresetManager({ currentState, onLoadPreset }: ViewerPresetManagerProps) {
    const { t } = useTranslation();
    const inputId = useId();
    const {
        presets,
        createPreset,
        renamePreset,
        updatePreset,
        deletePreset,
        presetLimit,
        presetNameMaxLength,
    } = useViewerPresets();
    const [newPresetName, setNewPresetName] = useState('');
    const [formError, setFormError] = useState<string | null>(null);
    const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
    const [editingPresetName, setEditingPresetName] = useState('');
    const [pendingUpdatePresetId, setPendingUpdatePresetId] = useState<string | null>(null);
    const [pendingDeletePresetId, setPendingDeletePresetId] = useState<string | null>(null);

    const getCurrentDisplaySettings = () => pickViewerDisplaySettings(currentState);

    const showMutationError = (reason: ViewerPresetMutationError) => {
        const message = t(PRESET_ERROR_KEYS[reason], {
            limit: presetLimit,
            max: presetNameMaxLength,
        });

        setFormError(message);

        if (reason === 'limit-reached' || reason === 'not-found') {
            toast.warning(t('presets.toasts.errorTitle'), {
                description: message,
                dedupeKey: `viewer-preset-${reason}`,
            });
        }
    };

    const handleCreatePreset = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const result = createPreset(newPresetName, getCurrentDisplaySettings());
        if (!result.ok) {
            showMutationError(result.reason);
            return;
        }

        setNewPresetName('');
        setFormError(null);
        setPendingUpdatePresetId(null);
        setPendingDeletePresetId(null);
        toast.success(t('presets.toasts.saved'), { description: result.preset.name });
    };

    const handleLoadPreset = (preset: ViewerPreset) => {
        onLoadPreset(preset);
        setFormError(null);
        setPendingUpdatePresetId(null);
        setPendingDeletePresetId(null);
        toast.success(t('presets.toasts.loaded'), { description: preset.name });
    };

    const handleUpdatePreset = (preset: ViewerPreset) => {
        if (pendingUpdatePresetId !== preset.id) {
            setPendingUpdatePresetId(preset.id);
            setPendingDeletePresetId(null);
            return;
        }

        const result = updatePreset(preset.id, getCurrentDisplaySettings());
        if (!result.ok) {
            showMutationError(result.reason);
            return;
        }

        setFormError(null);
        setPendingUpdatePresetId(null);
        setPendingDeletePresetId(null);
        toast.success(t('presets.toasts.updated'), { description: result.preset.name });
    };

    const startRename = (preset: ViewerPreset) => {
        setEditingPresetId(preset.id);
        setEditingPresetName(preset.name);
        setPendingUpdatePresetId(null);
        setPendingDeletePresetId(null);
        setFormError(null);
    };

    const cancelRename = () => {
        setEditingPresetId(null);
        setEditingPresetName('');
    };

    const commitRename = (preset: ViewerPreset) => {
        const result = renamePreset(preset.id, editingPresetName);
        if (!result.ok) {
            showMutationError(result.reason);
            return;
        }

        setEditingPresetId(null);
        setEditingPresetName('');
        setFormError(null);
        setPendingUpdatePresetId(null);
        toast.success(t('presets.toasts.renamed'), { description: result.preset.name });
    };

    const handleRenameKeyDown = (event: KeyboardEvent<HTMLInputElement>, preset: ViewerPreset) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            commitRename(preset);
            return;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            cancelRename();
        }
    };

    const handleDeletePreset = (preset: ViewerPreset) => {
        if (pendingDeletePresetId !== preset.id) {
            setPendingDeletePresetId(preset.id);
            setPendingUpdatePresetId(null);
            return;
        }

        const result = deletePreset(preset.id);
        if (!result.ok) {
            showMutationError(result.reason);
            return;
        }

        setPendingDeletePresetId(null);
        setPendingUpdatePresetId(null);
        setFormError(null);
        toast.success(t('presets.toasts.deleted'), { description: preset.name });
    };

    return (
        <div className="flex flex-col gap-3">
            <form className="flex flex-col gap-1.5" onSubmit={handleCreatePreset}>
                <label htmlFor={inputId} className="sr-only">
                    {t('presets.nameLabel')}
                </label>
                <div className="flex gap-1.5">
                    <input
                        id={inputId}
                        value={newPresetName}
                        onChange={(event) => {
                            setNewPresetName(event.target.value);
                            setFormError(null);
                        }}
                        maxLength={presetNameMaxLength}
                        placeholder={t('presets.namePlaceholder')}
                        className={inputClassName}
                    />
                    <button type="submit" className={primaryButtonClassName}>
                        <Icon name="plus" size={12} />
                        {t('presets.save')}
                    </button>
                </div>
                {formError && (
                    <p className="text-[11px] leading-snug text-neon-amber" role="alert">
                        {formError}
                    </p>
                )}
            </form>

            {presets.length === 0 ? (
                <p className="rounded border border-white/10 bg-black/20 px-3 py-2 text-xs leading-5 text-white/45">
                    {t('presets.empty')}
                </p>
            ) : (
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                    {presets.map((preset) => {
                        const isEditing = editingPresetId === preset.id;
                        const isConfirmingUpdate = pendingUpdatePresetId === preset.id;
                        const isConfirmingDelete = pendingDeletePresetId === preset.id;
                        const formattedDate = formatPresetDate(preset.updatedAt);

                        return (
                            <div
                                key={preset.id}
                                className="rounded-md border border-white/10 bg-black/20 p-2"
                            >
                                {isEditing ? (
                                    <div className="flex gap-1.5">
                                        <input
                                            value={editingPresetName}
                                            onChange={(event) => {
                                                setEditingPresetName(event.target.value);
                                                setFormError(null);
                                            }}
                                            onKeyDown={(event) =>
                                                handleRenameKeyDown(event, preset)
                                            }
                                            maxLength={presetNameMaxLength}
                                            className={inputClassName}
                                            aria-label={t('presets.renameAria', {
                                                name: preset.name,
                                            })}
                                            autoFocus
                                        />
                                        <button
                                            type="button"
                                            className={secondaryButtonClassName}
                                            onClick={() => commitRename(preset)}
                                            aria-label={t('presets.actions.saveRenameAria', {
                                                name: preset.name,
                                            })}
                                        >
                                            <Icon name="check" size={12} />
                                        </button>
                                        <button
                                            type="button"
                                            className={secondaryButtonClassName}
                                            onClick={cancelRename}
                                            aria-label={t('presets.actions.cancelRename')}
                                        >
                                            <Icon name="close" size={12} />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="truncate text-xs font-semibold text-white/90">
                                                    {preset.name}
                                                </p>
                                                {formattedDate && (
                                                    <p className="mt-0.5 text-[10px] uppercase tracking-wider text-white/35">
                                                        {t('presets.updatedAt', {
                                                            date: formattedDate,
                                                        })}
                                                    </p>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                className={primaryButtonClassName}
                                                onClick={() => handleLoadPreset(preset)}
                                                aria-label={t('presets.actions.loadAria', {
                                                    name: preset.name,
                                                })}
                                            >
                                                {t('presets.actions.load')}
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-3 gap-1 pt-2.5">
                                            <button
                                                type="button"
                                                className={
                                                    isConfirmingUpdate
                                                        ? confirmUpdateButtonClassName
                                                        : secondaryButtonClassName
                                                }
                                                onClick={() => handleUpdatePreset(preset)}
                                                aria-label={t('presets.actions.updateAria', {
                                                    name: preset.name,
                                                })}
                                            >
                                                {isConfirmingUpdate
                                                    ? t('presets.actions.confirmDelete')
                                                    : t('presets.actions.update')}
                                            </button>
                                            <button
                                                type="button"
                                                className={secondaryButtonClassName}
                                                onClick={() => startRename(preset)}
                                                aria-label={t('presets.actions.renameAria', {
                                                    name: preset.name,
                                                })}
                                            >
                                                {t('presets.actions.rename')}
                                            </button>
                                            <button
                                                type="button"
                                                className={
                                                    isConfirmingDelete
                                                        ? dangerButtonClassName
                                                        : secondaryButtonClassName
                                                }
                                                onClick={() => handleDeletePreset(preset)}
                                                aria-label={t('presets.actions.deleteAria', {
                                                    name: preset.name,
                                                })}
                                            >
                                                {isConfirmingDelete
                                                    ? t('presets.actions.confirmDelete')
                                                    : t('presets.actions.delete')}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
