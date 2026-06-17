import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface SourceManifest {
    sourceFileDateRange?: {
        from?: string | null;
        to?: string | null;
    };
    software?: string[];
}

interface SourceAttributionProps {
    manifestUrl: string;
    className?: string;
    onVisibleChange?: (visible: boolean) => void;
}

function formatDateRange(range: SourceManifest['sourceFileDateRange']) {
    const from = range?.from;
    const to = range?.to;

    if (!from && !to) return null;
    if (!from) return to ?? null;
    if (!to || from === to) return from;

    return `${from} - ${to}`;
}

function formatSoftware(software: SourceManifest['software']) {
    if (!software?.length) return null;

    return software.filter(Boolean).join(', ');
}

export function SourceAttribution({
    manifestUrl,
    className = '',
    onVisibleChange,
}: SourceAttributionProps) {
    const { t } = useTranslation();
    const [manifest, setManifest] = useState<SourceManifest | null>(null);

    useEffect(() => {
        const controller = new AbortController();

        void fetch(manifestUrl, { signal: controller.signal })
            .then((response) => (response.ok ? response.json() : null))
            .then((data: SourceManifest | null) => {
                const isVisible =
                    Boolean(formatDateRange(data?.sourceFileDateRange)) &&
                    Boolean(formatSoftware(data?.software));

                setManifest(data);
                onVisibleChange?.(isVisible);
            })
            .catch((error: unknown) => {
                if (error instanceof DOMException && error.name === 'AbortError') return;
                setManifest(null);
                onVisibleChange?.(false);
            });

        return () => controller.abort();
    }, [manifestUrl, onVisibleChange]);

    const dateRange = formatDateRange(manifest?.sourceFileDateRange);
    const software = formatSoftware(manifest?.software);

    if (!dateRange || !software) return null;

    return (
        <div
            className={`flex max-w-[calc(100vw-5rem)] items-center gap-1.5 rounded-tl-[3px] border border-b-0 border-r-0 border-white/10 bg-black/65 px-2 py-1 text-[10px] font-medium leading-none text-white/70 shadow-[0_2px_10px_rgba(0,0,0,0.35)] backdrop-blur-sm ${className}`}
        >
            <span>{t('sourceAttribution.label', { dateRange })}</span>
            <span aria-hidden="true">{'\u00b7'}</span>
            <span>{software}</span>
            <span aria-hidden="true">{'\u00b7'}</span>
            <a
                href="https://www.geoportal.lt/"
                target="_blank"
                rel="noreferrer"
                className="text-white/75 underline-offset-2 transition-colors hover:text-white hover:underline focus-visible:text-white focus-visible:underline focus-visible:outline-none"
            >
                {t('sourceAttribution.provider')}
            </a>
        </div>
    );
}
