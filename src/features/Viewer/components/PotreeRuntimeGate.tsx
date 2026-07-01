import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { loadPotreeRuntime } from '../utils/potreeRuntime';

export function PotreeRuntimeGate({ children }: { children: ReactNode }) {
    const { t } = useTranslation();
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let active = true;

        void loadPotreeRuntime().then(
            () => active && setStatus('ready'),
            () => active && setStatus('error')
        );

        return () => {
            active = false;
        };
    }, [attempt]);

    if (status === 'ready') return children;

    return (
        <div
            data-testid="viewer-runtime-gate"
            className="flex h-dvh w-screen flex-col items-center justify-center gap-4 bg-void-black text-white/70"
        >
            <p role="status">
                {status === 'error' ? t('viewer.runtime.loadError') : t('viewer.runtime.loading')}
            </p>
            {status === 'error' && (
                <button
                    type="button"
                    data-testid="viewer-runtime-retry"
                    className="rounded border border-neon-amber/60 px-4 py-2 text-neon-amber transition-colors hover:bg-neon-amber/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-amber"
                    onClick={() => {
                        setStatus('loading');
                        setAttempt((currentAttempt) => currentAttempt + 1);
                    }}
                >
                    {t('viewer.runtime.retry')}
                </button>
            )}
        </div>
    );
}
