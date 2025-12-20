import { createFileRoute, useRouter } from '@tanstack/react-router';
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

    return (
        <ViewerPage
            cellId={cellId}
            onBack={() =>
                void router.navigate({
                    to: '/',
                })
            }
            initialState={searchParams}
        />
    );
}
