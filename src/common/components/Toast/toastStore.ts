import type { ToastOptions, ToastRecord, ToastVariant, ToastVariantOptions } from './types';

const DEFAULT_DURATION = 6_000;
const MAX_VISIBLE_TOASTS = 4;

let nextToastId = 0;
let toastSnapshot: ToastRecord[] = [];
const listeners = new Set<() => void>();

function emitChange() {
    for (const listener of listeners) {
        listener();
    }
}

function createToastId() {
    nextToastId += 1;
    return `toast-${Date.now()}-${nextToastId}`;
}

export function subscribeToToasts(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function getToastSnapshot() {
    return toastSnapshot;
}

function showToast(options: ToastOptions) {
    const variant = options.variant ?? 'info';
    const duration = options.duration ?? DEFAULT_DURATION;

    if (options.dedupeKey) {
        const existingIndex = toastSnapshot.findIndex(
            (item) => item.dedupeKey === options.dedupeKey
        );

        if (existingIndex !== -1) {
            const existing = toastSnapshot[existingIndex];
            const updated: ToastRecord = {
                ...options,
                id: existing.id,
                variant,
                duration,
                revision: existing.revision + 1,
            };

            toastSnapshot = [
                updated,
                ...toastSnapshot.filter((_, index) => index !== existingIndex),
            ];
            emitChange();
            return updated.id;
        }
    }

    const toastRecord: ToastRecord = {
        ...options,
        id: createToastId(),
        variant,
        duration,
        revision: 0,
    };

    toastSnapshot = [toastRecord, ...toastSnapshot].slice(0, MAX_VISIBLE_TOASTS);
    emitChange();
    return toastRecord.id;
}

export function dismissToast(id: string) {
    const nextSnapshot = toastSnapshot.filter((item) => item.id !== id);
    if (nextSnapshot.length === toastSnapshot.length) return;

    toastSnapshot = nextSnapshot;
    emitChange();
}

function dismissAllToasts() {
    if (toastSnapshot.length === 0) return;

    toastSnapshot = [];
    emitChange();
}

function showVariantToast(variant: ToastVariant, title: string, options: ToastVariantOptions = {}) {
    return showToast({ ...options, title, variant });
}

export const toast = {
    show: showToast,
    info: (title: string, options?: ToastVariantOptions) =>
        showVariantToast('info', title, options),
    success: (title: string, options?: ToastVariantOptions) =>
        showVariantToast('success', title, options),
    warning: (title: string, options?: ToastVariantOptions) =>
        showVariantToast('warning', title, options),
    error: (title: string, options?: ToastVariantOptions) =>
        showVariantToast('error', title, options),
    dismiss: dismissToast,
    dismissAll: dismissAllToasts,
};
