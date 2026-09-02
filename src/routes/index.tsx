import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { SEOHead } from '@/common/components';
import { useModal } from '@/common/hooks';
import { AboutProjectModal, GridVisualizer } from '@/features/GridMap';

const footerLinkClassName =
    'theme-grid-footer-link text-theme-brand/85 underline-offset-2 transition-colors hover:text-theme-brand focus-visible:text-theme-brand focus-visible:underline focus-visible:outline-none';

export const Route = createFileRoute('/')({
    component: HomePage,
});

function HomePage() {
    const { t } = useTranslation();
    const { openModal } = useModal();

    const handleOpenAbout = () => {
        void openModal<void>({
            component: AboutProjectModal,
            titleKey: 'home.about.title',
            size: 'wide',
        });
    };

    return (
        <>
            <SEOHead title={t('seo.homeTitle')} description={t('seo.homeDescription')} path="/" />
            <div className="flex h-screen flex-col overflow-hidden bg-app-bg text-panel-text">
                <header className="theme-grid-chrome flex shrink-0 justify-center border-b border-panel-border p-4">
                    <div className="flex max-w-full items-center justify-center gap-3 sm:gap-4">
                        <img
                            src="/lidar-icon.svg"
                            alt=""
                            aria-hidden="true"
                            className="size-10 shrink-0 sm:size-12"
                        />
                        <div className="min-w-0">
                            <h1 className="text-center text-lg font-bold tracking-widest text-theme-brand sm:text-2xl">
                                {t('home.title')}
                            </h1>
                            <p className="text-center text-sm text-panel-muted">
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

                <footer className="theme-grid-chrome shrink-0 border-t border-panel-border p-2 text-center text-xs text-panel-muted">
                    Žemėlapis:{' '}
                    <a
                        href="https://www.geoportal.lt/"
                        target="_blank"
                        rel="noreferrer"
                        className={footerLinkClassName}
                    >
                        geoportal.lt
                    </a>{' '}
                    © Aplinkos ministerija, © SSVA, 2026 ·{' '}
                    <button
                        type="button"
                        onClick={handleOpenAbout}
                        className={`${footerLinkClassName} cursor-pointer`}
                    >
                        {t('home.aboutProject')}
                    </button>
                </footer>
            </div>
        </>
    );
}
