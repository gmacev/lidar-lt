import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../Icon';

interface ModalProps {
    children: ReactNode;
    onClose: () => void;
    /** Optional title for the modal header */
    title?: string;
    /** Whether clicking the backdrop closes the modal (default: true) */
    closeOnBackdrop?: boolean;
    /** Whether pressing Escape closes the modal (default: true) */
    closeOnEscape?: boolean;
}

/**
 * Base modal component that renders via React Portal.
 * Handles backdrop, escape key, and focus management.
 */
export function Modal({
    children,
    onClose,
    title,
    closeOnBackdrop = true,
    closeOnEscape = true,
}: ModalProps) {
    // Handle escape key
    useEffect(() => {
        if (!closeOnEscape) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [closeOnEscape, onClose]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, []);

    const handleBackdropClick = () => {
        if (closeOnBackdrop) {
            onClose();
        }
    };

    const modalContent = (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'modal-title' : undefined}
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={handleBackdropClick}
                aria-hidden="true"
            />

            {/* Modal container */}
            <div
                className="relative z-10 w-full max-w-md rounded-xl border border-white/10 bg-void-black/95 shadow-2xl backdrop-blur-xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                {title && (
                    <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                        <h2 id="modal-title" className="text-lg font-semibold text-white">
                            {title}
                        </h2>
                        <button
                            onClick={onClose}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 transition-all hover:bg-white/10 hover:text-white"
                            aria-label="Close modal"
                        >
                            <Icon name="close" size={14} strokeWidth={2} />
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className={title ? '' : 'pt-5'}>{children}</div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
