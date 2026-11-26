import { queryCollection } from "@nuxt/content/server";

import seoData from "#seo-data";

// The fields read below. Nitro's types don't see the collections Docus defines.
interface DocsPage {
	path: string;
	meta: { sitemap?: boolean };
}

/**
 * Serves `/sitemap.xml` in place of Docus's route, which robots.txt points
 * crawlers at. Docus lists its docs and landing pages, and skips the landing
 * collection when the app has its own app/pages/index.vue, so the homepage
 * never made it in. This lists the homepage first, then the docs pages by
 * Docus's rule: `sitemap: false` in a page's frontmatter leaves it out. Then
 * the changelog and each of its entries.
 *
 * The homepage's and each docs page's `<lastmod>` is the date of the last commit
 * of the page's source file, which modules/seo.ts reads at build time (audit
 * finding C5). The changelog is last modified with its newest entry, and each
 * entry on the day its release was published, cut to the day, since an entry
 * that shares its day with another carries a time too.
 *
 * Nitro keeps the first handler for a route, and it scans the app's server/
 * before the layers'. Docus still adds the route to the prerendered ones.
 */
export default defineEventHandler(async (event) => {
	const { siteUrl } = useRuntimeConfig(event).public;
	const pages = (await queryCollection(event, "docs" as never).all()) as Array<DocsPage>;

	const entries = await queryCollection(event, "changelog").order("date", "DESC").all();
	const day = (date: string | undefined) => date?.split("T")[0];

	const urls = [
		...[
			"/",
			...pages
				.filter((page) => page.meta.sitemap !== false && !isNavigationPath(page.path))
				.map((page) => page.path),
		].map((path) => ({ loc: path, lastmod: seoData.lastmod[path] })),
		{ loc: "/changelog", lastmod: day(entries[0]?.date) },
		...entries.map((entry) => ({ loc: entry.path, lastmod: day(entry.date) })),
	];

	setHeader(event, "Content-Type", "application/xml");
	return [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		...urls.map(({ loc, lastmod }) =>
			[
				"  <url>",
				`    <loc>${escapeXml(siteUrl + loc)}</loc>`,
				...(lastmod ? [`    <lastmod>${escapeXml(lastmod)}</lastmod>`] : []),
				"  </url>",
			].join("\n"),
		),
		"</urlset>",
	].join("\n");
});

const XML_ENTITIES: Record<string, string> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&apos;",
};

function escapeXml(value: string) {
	return value.replaceAll(/[&<>"']/g, (char) => XML_ENTITIES[char]!);
}
