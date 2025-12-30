import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';

interface SEOHeadProps {
    title: string;
    description: string;
    /** Relative path to image, e.g. "/og-image.jpg" */
    image?: string;
    /** Current page path for canonical URL, e.g. "/viewer/35_71" */
    path?: string;
}

/**
 * SEO head component for managing dynamic meta tags.
 *
 * Uses window.location.origin to dynamically determine the current domain,
 * so no hardcoding is needed for different environments.
 */
export function SEOHead({ title, description, image = '/og-image.jpg', path = '' }: SEOHeadProps) {
    const { i18n } = useTranslation();

    // Dynamically get current domain (works in dev, preview, and production)
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const fullUrl = `${origin}${path}`;
    const imageUrl = `${origin}${image}`;

    return (
        <Helmet>
            {/* Dynamic HTML lang attribute */}
            <html lang={i18n.language} />

            {/* Primary meta tags */}
            <title>{title}</title>
            <meta name="title" content={title} />
            <meta name="description" content={description} />

            {/* Canonical URL */}
            <link rel="canonical" href={fullUrl} />

            {/* Open Graph / Facebook */}
            <meta property="og:type" content="website" />
            <meta property="og:url" content={fullUrl} />
            <meta property="og:title" content={title} />
            <meta property="og:description" content={description} />
            <meta property="og:image" content={imageUrl} />

            {/* Twitter */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:url" content={fullUrl} />
            <meta name="twitter:title" content={title} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={imageUrl} />
        </Helmet>
    );
}
