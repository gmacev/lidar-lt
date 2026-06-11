import { useEffect, useRef, useSyncExternalStore, type FocusEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Icon, type IconName } from '../Icon';
import { dismissToast, getToastSnapshot, subscribeToToasts } from './toastStore';
import type { ToastRecord, ToastVariant } from './types';

interface ToastProviderProps {
    children: ReactNode;
}

const variantStyles: Record<
    ToastVariant,
    { icon: IconName; accent: string; iconBackground: string }
> = {
    info: {
        icon: 'info',
        accent: 'border-white/15',
        iconBackground: 'bg-white/10 text-white/80',
    },
    success: {
        icon: 'checkCircle',
        accent: 'border-laser-green/35',
        iconBackground: 'bg-laser-green/[0.12] text-laser-green',
    },
    warning: {
        icon: 'warningTriangle',
        accent: 'border-neon-amber/45',
        iconBackground: 'bg-neon-amber/[0.12] text-neon-amber',
    },
    error: {
        icon: 'alertCircle',
        accent: 'border-plasma-red/45',
        iconBackground: 'bg-plasma-red/[0.12] text-plasma-red',
    },
};

function ToastItem({ item }: { item: ToastRecord }) {
    const { t } = useTranslation();
    const timeoutRef = useRef<number | null>(null);
    const startedAtRef = useRef(0);
    const remainingRef = useRef(item.duration);

    const clearTimer = () => {
        if (timeoutRef.current === null) return;

        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
    };

    const startTimer = () => {
        clearTimer();
        if (remainingRef.current <= 0) return;

        startedAtRef.current = Date.now();
        timeoutRef.current = window.setTimeout(() => {
            dismissToast(item.id);
        }, remainingRef.current);
    };

    const pauseTimer = () => {
        if (timeoutRef.current === null) return;

        remainingRef.current = Math.max(
            0,
            remainingRef.current - (Date.now() - startedAtRef.current)
        );
        clearTimer();
    };

    useEffect(() => {
        remainingRef.current = item.duration;
        startTimer();

        const handleVisibilityChange = () => {
            if (document.hidden) {
                pauseTimer();
            } else {
                startTimer();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            clearTimer();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [item.duration, item.id, item.revision]);

    const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
        if (
            event.relatedTarget instanceof Node &&
            event.currentTarget.contains(event.relatedTarget)
        ) {
            return;
        }
        startTimer();
    };

    const styles = variantStyles[item.variant];
    const liveMode = item.variant === 'error' ? 'assertive' : 'polite';

    return (
        <div
            className={`toast-enter pointer-events-auto w-full overflow-hidden rounded-lg border bg-deep-space/96 shadow-[0_18px_60px_rgba(0,0,0,0.55)] backdrop-blur-md ${styles.accent}`}
            role={item.variant === 'error' ? 'alert' : 'status'}
            aria-live={liveMode}
            aria-atomic="true"
            onMouseEnter={pauseTimer}
            onMouseLeave={startTimer}
            onFocusCapture={pauseTimer}
            onBlurCapture={handleBlur}
        >
            <div className="flex items-start gap-3 px-3.5 py-3">
                <div
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${styles.iconBackground}`}
                    aria-hidden="true"
                >
                    <Icon name={styles.icon} size={17} strokeWidth={2} />
                </div>

                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-5 text-white">{item.title}</p>
                    {item.description && (
                        <p className="mt-0.5 text-xs leading-5 text-white/65">{item.description}</p>
                    )}
                    {item.action && (
                        <button
                            type="button"
                            className="mt-2 text-xs font-semibold text-neon-amber transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-amber/70"
                            onClick={() => {
                                item.action?.onClick();
                                dismissToast(item.id);
                            }}
                        >
                            {item.action.label}
                        </button>
                    )}
                </div>

                <button
                    type="button"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/35 transition-colors hover:bg-white/8 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                    onClick={() => dismissToast(item.id)}
                    aria-label={t('common.dismissNotification')}
                >
                    <Icon name="close" size={14} />
                </button>
            </div>
        </div>
    );
}

function ToastViewport() {
    const { t } = useTranslation();
    const toasts = useSyncExternalStore(subscribeToToasts, getToastSnapshot, getToastSnapshot);

    if (toasts.length === 0) return null;

    return createPortal(
        <div
            className="pointer-events-none fixed left-1/2 top-3 z-[10000] flex w-[min(92vw,28rem)] -translate-x-1/2 flex-col gap-2 px-2 sm:top-4"
            aria-label={t('common.notifications')}
        >
            {toasts.map((item) => (
                <ToastItem key={item.id} item={item} />
            ))}
        </div>,
        document.body
    );
}

export function ToastProvider({ children }: ToastProviderProps) {
    return (
        <>
            {children}
            <ToastViewport />
        </>
    );
}
