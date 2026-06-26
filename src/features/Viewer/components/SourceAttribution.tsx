import { useTranslation } from 'react-i18next';

interface SourceAttributionProps {
    dateRange: string;
}

export function SourceAttribution({ dateRange }: SourceAttributionProps) {
    const { t } = useTranslation();

    return (
        <>
            <span className="whitespace-nowrap">{t('sourceAttribution.label', { dateRange })}</span>
            <span aria-hidden="true" className="text-white/35">
                {'\u00b7'}
            </span>
            <a
                href="https://www.geoportal.lt/"
                target="_blank"
                rel="noreferrer"
                className="whitespace-nowrap text-white/75 underline-offset-2 transition-colors hover:text-white hover:underline focus-visible:text-white focus-visible:underline focus-visible:outline-none"
            >
                {t('sourceAttribution.provider')}
            </a>
        </>
    );
}
