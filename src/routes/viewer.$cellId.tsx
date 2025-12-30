import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { SEOHead } from '@/common/components';
import { ViewerPage } from '@/features/Viewer';
import { ViewerStateSchema } from '@/features/Viewer/config/viewerConfig';

export const Route = createFileRoute('/viewer/$cellId')({
    component: ViewerRoute,
    validateSearch: ViewerStateSchema,
});

function ViewerRoute() {
    const { cellId } = Route.useParams();
    const searchParams = Route.useSearch();
    const router = useRouter();
    const { t } = useTranslation();

    return (
        <>
            <SEOHead
                title={t('seo.viewerTitle', { cellId })}
                description={t('seo.viewerDescription', { cellId })}
            />
            <ViewerPage
                cellId={cellId}
                onBack={() =>
                    void router.navigate({
                        to: '/',
                    })
                }
                initialState={searchParams}
            />
        </>
    );
}
