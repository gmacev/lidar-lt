import { Helmet } from 'react-helmet-async';

interface SEOHeadProps {
    title: string;
    description: string;
    /** Relative path to image, e.g. "/og-image.jpg" */
    image?: string;
}

/**
 * SEO head component for managing dynamic meta tags.
 *
 * Note: Since this is a client-side SPA, search engine crawlers will
 * primarily see the static index.html meta tags. However, this component
 * is useful for:
 * - Social media platforms that execute JavaScript
 * - Keeping document head consistent as users navigate
 */
export function SEOHead({ title, description, image = '/og-image.jpg' }: SEOHeadProps) {
    return (
        <Helmet>
            {/* Primary meta tags */}
            <title>{title}</title>
            <meta name="title" content={title} />
            <meta name="description" content={description} />

            {/* Open Graph / Facebook */}
            <meta property="og:title" content={title} />
            <meta property="og:description" content={description} />
            <meta property="og:image" content={image} />

            {/* Twitter */}
            <meta name="twitter:title" content={title} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={image} />
        </Helmet>
    );
}
