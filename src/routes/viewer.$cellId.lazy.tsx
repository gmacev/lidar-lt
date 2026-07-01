import { createLazyFileRoute, useRouter } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { SEOHead } from '@/common/components';
import { PotreeRuntimeGate, ViewerPage } from '@/features/Viewer';

export const Route = createLazyFileRoute('/viewer/$cellId')({
    component: ViewerRoute,
});

function ViewerRoute() {
    const { cellId } = Route.useParams();
    const searchParams = Route.useSearch();
    const router = useRouter();
    const { t } = useTranslation();

    return (
        <>
            <SEOHead
                title={t('seo.viewerTitle', { sectorName: searchParams.sectorName ?? cellId })}
                description={t('seo.viewerDescription', {
                    sectorName: searchParams.sectorName ?? cellId,
                })}
                path={`/viewer/${cellId}${searchParams.sectorName ? `?sectorName=${encodeURIComponent(searchParams.sectorName)}` : ''}`}
            />
            <PotreeRuntimeGate>
                <ViewerPage
                    key={cellId}
                    cellId={cellId}
                    onBack={() =>
                        void router.navigate({
                            to: '/',
                        })
                    }
                    initialState={searchParams}
                />
            </PotreeRuntimeGate>
        </>
    );
}
