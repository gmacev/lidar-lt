import { createContext, type ComponentType } from 'react';

/**
 * Props passed to modal content components
 */
export interface ModalContentProps<T> {
    onClose: () => void;
    onConfirm: (result: T) => void;
}

/**
 * Configuration for opening a modal
 */
export interface ModalConfig<T> {
    /** The component to render inside the modal */
    component: ComponentType<ModalContentProps<T>>;
    /** Title for the modal header */
    title?: string;
    /** Translation key for the modal header (takes precedence over title) */
    titleKey?: string;
    /** Whether clicking backdrop closes (default: true) */
    closeOnBackdrop?: boolean;
    /** Whether escape key closes (default: true) */
    closeOnEscape?: boolean;
}

export interface ModalContextValue {
    /**
     * Open a modal and wait for the result.
     * Returns the confirmed value, or null if cancelled/closed.
     */
    openModal: <T>(config: ModalConfig<T>) => Promise<T | null>;
    /** Close the current modal without a result */
    closeModal: () => void;
}

export const ModalContext = createContext<ModalContextValue | null>(null);
