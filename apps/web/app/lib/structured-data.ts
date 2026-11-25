// The site's JSON-LD (audit findings S1, S2 and S3). The head emits it from two
// places outside the app: `useUxHead` (@uxfront/layer-ui) gives the homepage an
// Organization named after the product, and Docus's `useSeo` gives docs pages an
// Article and breadcrumbs that link sections with no page. The head plugin
// (app/plugins/seo-head.ts) rewrites their blocks with these functions.

import { GITHUB_URL, NPM_URL, SITE_URL, UXFRONT_URL } from "../data/site.ts";

type Node = Record<string, unknown>;

const WEBSITE_ID = `${SITE_URL}/#website`;
const SOFTWARE_ID = `${SITE_URL}/#software`;
const PUBLISHER_ID = `${UXFRONT_URL}/#organization`;

const publisher = {
	"@type": "Organization",
	"@id": PUBLISHER_ID,
	name: "UXFront",
	url: UXFRONT_URL,
};
const website = { "@type": "WebSite", "@id": WEBSITE_ID, name: "Unframework", url: `${SITE_URL}/` };

/** The homepage's graph: the site, the software it documents, and UXFront, who publishes both. */
export function homeGraph(description: string): Node {
	return {
		"@context": "https://schema.org",
		"@graph": [
			{
				...website,
				description,
				inLanguage: "en",
				about: { "@id": SOFTWARE_ID },
				publisher: { "@id": PUBLISHER_ID },
			},
			{
				"@type": "SoftwareSourceCode",
				"@id": SOFTWARE_ID,
				name: "Unframework",
				description,
				url: `${SITE_URL}/`,
				codeRepository: GITHUB_URL,
				programmingLanguage: "TypeScript",
				license: "https://opensource.org/licenses/MIT",
				sameAs: [GITHUB_URL, NPM_URL],
				publisher: { "@id": PUBLISHER_ID },
			},
			publisher,
		],
	};
}

export interface ArticleExtras {
	/** The date of the last commit of the page's source, as in the sitemap. */
	dateModified?: string;
	/** The page's Open Graph image. */
	image?: string;
}

/**
 * Docus's Article as a TechArticle, with the date, the image, and UXFront as
 * the author and publisher. The publisher and the site keep the homepage's
 * `@id`s, with their names, so the block also reads on its own.
 */
export function techArticle(article: Node, { dateModified, image }: ArticleExtras): Node {
	const { publisher: _docusPublisher, ...rest } = article;
	return {
		...rest,
		"@type": "TechArticle",
		...(dateModified && { dateModified }),
		...(image && { image }),
		inLanguage: "en",
		author: publisher,
		publisher,
		isPartOf: website,
	};
}

interface ListItem {
	name?: string;
	item?: string;
}

/**
 * Docus's breadcrumbs, from the homepage, with every crumb on a page that
 * exists. A crumb that links a docs section, which has no page, links the
 * section's first page instead, as the sidebar does, and is dropped when that
 * is the next crumb's page (on a section's first page). `sections` maps a
 * section's path to its first page's.
 */
export function breadcrumbList(list: Node, sections: Record<string, string>): Node {
	const items = (Array.isArray(list.itemListElement) ? list.itemListElement : []) as ListItem[];
	const home = { "@type": "ListItem", name: "Unframework", item: `${SITE_URL}/` };
	const linked = [home, ...items].map((entry) => {
		if (!entry.item?.startsWith(SITE_URL)) return entry;
		const first = sections[entry.item.slice(SITE_URL.length)];
		return first ? { ...entry, item: `${SITE_URL}${first}` } : entry;
	});
	const kept = linked.filter((entry, index) => entry.item !== linked[index + 1]?.item);
	return {
		...list,
		itemListElement: kept.map((entry, index) => ({ ...entry, position: index + 1 })),
	};
}
