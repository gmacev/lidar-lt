import { useContext } from 'react';
import { ModalContext } from '../components/Modal/ModalContext';
import type { ModalContextValue } from '../components/Modal/ModalContext';

/**
 * Hook to access the modal system.
 * Must be used within a ModalProvider.
 */
export function useModal(): ModalContextValue {
    const context = useContext<ModalContextValue | null>(ModalContext);
    if (!context) {
        throw new Error('useModal must be used within a ModalProvider');
    }
    return context;
}
