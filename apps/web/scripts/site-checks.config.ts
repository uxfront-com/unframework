// The search and AI search rules the built site keeps (apps/web/README.md, "The SEO check").
// `pnpm check:seo` runs them on dist with `site-checks seo`. The parsing profile reads each page
// as this site's own checker did before it moved to the shared package, so the rules check what
// they checked then.

import { defineConfig } from "@uxfront/site-checks";

import { payload } from "./payload.ts";

export default defineConfig({
	site: "https://unframework.dev",
	parse: {
		scope: "head",
		titleScope: "head",
		titleTag: "any",
		trimTitle: "before-decode",
		quotes: "any",
		caseSensitiveTags: false,
		tagEnd: "word",
		metaKey: "property-first",
		trimValues: false,
		decode: ["numeric", "amp", "lt", "gt", "quot", "apos"],
		decodeOrder: "one-pass",
		decodeIgnoreCase: true,
		count: "utf-16",
		h1: "rendered",
		nodes: "graph-or-block",
		typeArrays: false,
		jsonLdType: "exact",
		blankLines: "whitespace",
		trimSitemap: true,
		mergeDuplicateLocs: false,
		headersParser: "lines",
	},
	rules: {
		"sitemap-duplicates": true,
		lastmod: { format: "date", realDate: "date-only" },
		"sitemap-pages": { paths: "exact" },
		"sitemap-indexable": {
			sources: [
				{ type: "meta", names: ["robots"], word: true, property: true },
				{ type: "redirects" },
				// The host rules keep www and workers.dev out of the index, not a path of this host.
				{ type: "headers", hosts: "ignore", word: true },
			],
		},
		"sitemap-coverage": true,
		canonical: { exactlyOne: true, rel: "exact", requireHref: true },
		lang: { lang: false },
		"open-graph": { url: "loc" },
		"og-image-size-tags": true,
		"og-image-file": { types: ["png", "jpeg"], png: "name" },
		twitter: { card: "any" },
		"twitter-text": true,
		"json-ld-types": {
			types: {
				"/": ["WebSite", "SoftwareSourceCode", "Organization"],
				"/docs/*": ["TechArticle", "BreadcrumbList"],
			},
		},
		"json-ld-breadcrumbs": { scope: ["/docs/*"], nodes: "first", item: ["url"] },
		"json-ld-article": { scope: ["/docs/*"] },
		// UXFront publishes the site, so no page names Unframework as an organisation.
		"json-ld-organization": { name: "Unframework", scope: ["*"] },
		"robots-sitemap": { match: "trimmed" },
		// The package's nine AI crawlers, the list this site allows by name (plan decision Q1).
		"robots-crawlers": { allow: "first", case: "exact", groupRules: "allow-disallow" },
		llms: { first: "non-empty" },
		"llms-summary": { position: "second" },
		"llms-links": { scope: ["/docs/*"], form: "parens" },
		"llms-full": true,
		"markdown-clean": { files: ["llms-full.txt"], tables: "line-start" },
		"redirects-permanent": { needsDestination: true },
		"headers-noindex": {
			patterns: ["https://www.unframework.dev/*", "https://:version.:subdomain.workers.dev/*"],
		},
	},
	extraRules: [payload],
});
