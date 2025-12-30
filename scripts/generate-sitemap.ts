/**
 * Sitemap Generator Script
 *
 * Generates sitemap.xml from grid.json at build time.
 * Run with: npx tsx scripts/generate-sitemap.ts
 *
 * Set SITE_URL environment variable for absolute URLs (required for valid sitemaps)
 * Example: SITE_URL=https://your-domain.com npm run build
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface GridFeature {
    type: 'Feature';
    properties: {
        id: string;
        name: string;
    };
}

interface GridData {
    type: 'FeatureCollection';
    features: GridFeature[];
}

// Base URL from environment variable
const BASE_URL = process.env.SITE_URL ?? '';

function generateSitemap(): void {
    if (!BASE_URL) {
        console.log('ℹ️  SITE_URL not set. Skipping sitemap generation.');
        console.log('   For production, set SITE_URL=https://your-domain.com');
        return;
    }

    // Read grid data
    const gridPath = resolve(__dirname, '../src/assets/grid.json');
    const gridData = JSON.parse(readFileSync(gridPath, 'utf-8')) as GridData;

    // Generate URLs
    const urls: string[] = [];

    // Homepage
    urls.push(`
    <url>
        <loc>${BASE_URL}/</loc>
        <priority>1.0</priority>
        <changefreq>monthly</changefreq>
    </url>`);

    // Sector pages
    for (const feature of gridData.features) {
        const { id, name } = feature.properties;
        const normalizedId = id.replace(/\//g, '_');
        const encodedName = encodeURIComponent(name);
        const url = `${BASE_URL}/viewer/${normalizedId}?sectorName=${encodedName}`;

        urls.push(`
    <url>
        <loc>${url}</loc>
        <changefreq>yearly</changefreq>
    </url>`);
    }

    // Build sitemap XML
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}
</urlset>
`;

    // Write to dist folder (created by Vite build)
    const outputPath = resolve(__dirname, '../dist/sitemap.xml');
    writeFileSync(outputPath, sitemap, 'utf-8');

    console.log(`✅ Sitemap generated with ${urls.length} URLs`);
    console.log(`   Output: ${outputPath}`);
}

generateSitemap();
