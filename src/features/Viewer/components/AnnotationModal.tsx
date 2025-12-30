import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ModalContentProps } from '@/common/components';

export interface AnnotationFormData {
    title: string;
    description: string;
}

/**
 * Modal content for creating/editing an annotation.
 * Prompts for title and description.
 */
export function AnnotationModal({ onClose, onConfirm }: ModalContentProps<AnnotationFormData>) {
    const { t } = useTranslation();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (title.trim()) {
            onConfirm({
                title: title.trim(),
                description: description.trim(),
            });
        }
    };

    const isValid = title.trim().length > 0;

    return (
        <form onSubmit={handleSubmit} className="p-5">
            <div className="flex flex-col gap-4">
                {/* Title input */}
                <div className="flex flex-col gap-1.5">
                    <label htmlFor="annotation-title" className="text-sm font-medium text-white/80">
                        {t('annotation.title')}
                    </label>
                    <input
                        id="annotation-title"
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={t('annotation.titlePlaceholder')}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-white/30 outline-none transition-all focus:border-neon-cyan/50 focus:bg-white/10"
                        autoFocus
                    />
                </div>

                {/* Description textarea */}
                <div className="flex flex-col gap-1.5">
                    <label
                        htmlFor="annotation-description"
                        className="text-sm font-medium text-white/80"
                    >
                        {t('annotation.description')}
                    </label>
                    <textarea
                        id="annotation-description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder={t('annotation.descriptionPlaceholder')}
                        rows={3}
                        className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-white/30 outline-none transition-all focus:border-neon-cyan/50 focus:bg-white/10"
                    />
                </div>

                {/* Buttons */}
                <div className="flex justify-end gap-2 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 transition-all hover:bg-white/10 hover:text-white"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        type="submit"
                        disabled={!isValid}
                        className="rounded-lg border border-neon-cyan/30 bg-neon-cyan/20 px-4 py-2 text-sm font-medium text-neon-cyan transition-all hover:bg-neon-cyan/30 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-neon-cyan/20"
                    >
                        {t('annotation.save')}
                    </button>
                </div>
            </div>
        </form>
    );
}
