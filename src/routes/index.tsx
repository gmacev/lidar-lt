import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { GridVisualizer } from '@/features/GridMap';

export const Route = createFileRoute('/')({
    component: HomePage,
});

function HomePage() {
    const { t } = useTranslation();

    return (
        <div className="flex h-screen flex-col overflow-hidden bg-void-black">
            <header className="shrink-0 border-b border-glass-border p-4">
                <h1 className="text-center text-2xl font-bold tracking-widest text-neon-amber">
                    {t('home.title')}
                </h1>
                <p className="text-center text-sm text-white/40">{t('home.subtitle')}</p>
            </header>

            <main className="min-h-0 flex-1">
                <div className="h-full overflow-hidden">
                    <GridVisualizer />
                </div>
            </main>

            <footer className="shrink-0 border-t border-glass-border p-2 text-center text-xs text-white/30">
                {t('home.footer')}
            </footer>
        </div>
    );
}
