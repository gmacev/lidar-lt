import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { HelmetProvider } from 'react-helmet-async';
import { ModalProvider } from '@/common/components';
import './i18n';
import './index.css';
import { routeTree } from './routeTree.gen';

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router;
    }
}

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <HelmetProvider>
            <ModalProvider>
                <RouterProvider router={router} />
            </ModalProvider>
        </HelmetProvider>
    </StrictMode>
);
