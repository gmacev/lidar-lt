import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { SEOHead } from '@/common/components';
import { GridVisualizer } from '@/features/GridMap';

export const Route = createFileRoute('/')({
    component: HomePage,
});

function HomePage() {
    const { t } = useTranslation();

    return (
        <>
            <SEOHead title={t('seo.homeTitle')} description={t('seo.homeDescription')} path="/" />
            <div className="flex h-screen flex-col overflow-hidden bg-void-black">
                <header className="flex shrink-0 justify-center border-b border-glass-border p-4">
                    <div className="flex max-w-full items-center justify-center gap-3 sm:gap-4">
                        <img
                            src="/lidar-icon.svg"
                            alt=""
                            aria-hidden="true"
                            className="size-10 shrink-0 sm:size-12"
                        />
                        <div className="min-w-0">
                            <h1 className="text-center text-lg font-bold tracking-widest text-neon-amber sm:text-2xl">
                                {t('home.title')}
                            </h1>
                            <p className="text-center text-sm text-white/40">
                                {t('home.subtitle')}
                            </p>
                        </div>
                    </div>
                </header>

                <main className="min-h-0 flex-1">
                    <div className="h-full overflow-hidden">
                        <GridVisualizer />
                    </div>
                </main>

                <footer className="shrink-0 border-t border-glass-border p-2 text-center text-xs text-white/30">
                    {t('home.footer')} · {t('home.mapAttribution')}
                </footer>
            </div>
        </>
    );
}
