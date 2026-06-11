export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export interface ToastAction {
    label: string;
    onClick: () => void;
}

export interface ToastOptions {
    title: string;
    description?: string;
    variant?: ToastVariant;
    duration?: number;
    dedupeKey?: string;
    action?: ToastAction;
}

export interface ToastRecord extends ToastOptions {
    id: string;
    variant: ToastVariant;
    duration: number;
    revision: number;
}

export type ToastVariantOptions = Omit<ToastOptions, 'title' | 'variant'>;
