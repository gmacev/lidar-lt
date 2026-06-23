import { useEffect } from 'react';
import { EPT_BASE_URL } from '@/features/Viewer/utils/viewerDataUrls';

function addResourceHint(rel: 'preconnect' | 'dns-prefetch', href: string) {
    const selector = `link[rel="${rel}"][href="${href}"]`;
    if (document.head.querySelector(selector)) return;

    const link = document.createElement('link');
    link.rel = rel;
    link.href = href;

    if (rel === 'preconnect') {
        link.crossOrigin = 'anonymous';
    }

    document.head.appendChild(link);
}

function preconnectToDataOrigin(dataBaseUrl: string) {
    try {
        const origin = new URL(dataBaseUrl, window.location.href).origin;
        if (origin === window.location.origin) return;

        addResourceHint('preconnect', origin);
        addResourceHint('dns-prefetch', `//${new URL(origin).host}`);
    } catch {
        // Ignore invalid or unset data URLs; Potree load will surface the real error.
    }
}

export function useViewerDataOriginPreconnect() {
    useEffect(() => {
        preconnectToDataOrigin(EPT_BASE_URL);
    }, []);
}
