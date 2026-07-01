import { createFileRoute } from '@tanstack/react-router';
import { ViewerStateSchema } from '@/features/Viewer/config/viewerConfig';

export const Route = createFileRoute('/viewer/$cellId')({
    validateSearch: ViewerStateSchema,
});
