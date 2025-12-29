import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from './Modal';
import { ModalContext, type ModalConfig, type ModalContextValue } from './ModalContext';

interface ModalState {
    config: ModalConfig<unknown> | null;
    resolve: ((result: unknown) => void) | null;
}

interface ModalProviderProps {
    children: ReactNode;
}

/**
 * Provider component for the modal system.
 * Wrap your app with this to enable useModal() throughout.
 */
export function ModalProvider({ children }: ModalProviderProps) {
    const { t } = useTranslation();
    const [modalState, setModalState] = useState<ModalState>({
        config: null,
        resolve: null,
    });

    const openModal = <T,>(config: ModalConfig<T>): Promise<T | null> => {
        return new Promise((resolve) => {
            setModalState({
                config: config as ModalConfig<unknown>,
                resolve: resolve as (result: unknown) => void,
            });
        });
    };

    const closeModal = () => {
        if (modalState.resolve) {
            modalState.resolve(null);
        }
        setModalState({ config: null, resolve: null });
    };

    const handleConfirm = (result: unknown) => {
        if (modalState.resolve) {
            modalState.resolve(result);
        }
        setModalState({ config: null, resolve: null });
    };

    const contextValue: ModalContextValue = {
        openModal,
        closeModal,
    };

    // Resolve title from titleKey or use title directly
    const resolvedTitle = modalState.config?.titleKey
        ? t(modalState.config.titleKey)
        : modalState.config?.title;

    return (
        <ModalContext.Provider value={contextValue}>
            {children}
            {modalState.config && (
                <Modal
                    onClose={closeModal}
                    title={resolvedTitle}
                    closeOnBackdrop={modalState.config.closeOnBackdrop}
                    closeOnEscape={modalState.config.closeOnEscape}
                >
                    <modalState.config.component onClose={closeModal} onConfirm={handleConfirm} />
                </Modal>
            )}
        </ModalContext.Provider>
    );
}
