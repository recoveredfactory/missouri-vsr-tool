#!/usr/bin/env node

/**
 * Generates sitemap.xml with all pages in both locales (en, es)
 *
 * URLs included:
 * - Homepage: /, /es/
 * - Agency pages: /agency/[slug], /es/agency/[slug]
 *
 * Run: pnpm generate:sitemap
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const BASE_URL = process.env.PUBLIC_SITE_URL || 'https://missourivsr.com';
const LOCALES = ['en', 'es'];
const BASE_LOCALE = 'en';

// Read agency index
const agencyIndexPath = join(__dirname, '../static/data/agency_index.json');
const agencies = JSON.parse(readFileSync(agencyIndexPath, 'utf-8'));

console.log(`Generating sitemap for ${agencies.length} agencies...`);
console.log(`Base URL: ${BASE_URL}`);

/**
 * Generate URL entry with hreflang alternates
 */
function generateUrlEntry(path) {
  const enUrl = `${BASE_URL}${path}`;
  const esUrl = `${BASE_URL}/es${path}`;

  return `  <url>
    <loc>${enUrl}</loc>
    <xhtml:link rel="alternate" hreflang="en" href="${enUrl}"/>
    <xhtml:link rel="alternate" hreflang="es" href="${esUrl}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${enUrl}"/>
  </url>`;
}

// Build sitemap
const urls = [];

// Homepage
urls.push(generateUrlEntry('/'));

// Agency pages
for (const agency of agencies) {
  if (agency.agency_slug) {
    urls.push(generateUrlEntry(`/agency/${agency.agency_slug}`));
  }
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`;

// Write sitemap
const outputPath = join(__dirname, '../static/sitemap.xml');
writeFileSync(outputPath, sitemap, 'utf-8');

console.log(`✓ Sitemap generated: ${outputPath}`);
console.log(`  Total URLs: ${urls.length} pages × 2 locales = ${urls.length * 2} URLs`);
