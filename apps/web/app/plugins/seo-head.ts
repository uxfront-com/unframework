import seoData from "#seo-data";
import { SITE_URL } from "~/data/site";
import { breadcrumbList, homeGraph, techArticle } from "~/lib/structured-data";

// Marks the meta tags this plugin fills in from the page's own tags.
const INFER = "data-seo-infer";

// The payload key that carries a docs page's og:image to the client.
const IMAGE = "seo-head:image";

/** A docs page's canonical URL and its og:image, as the server rendered them. */
interface PageImage {
	url: string;
	image: string;
}

interface Tag {
	tag: string;
	props: Record<string, unknown>;
	innerHTML?: unknown;
}

/**
 * Completes the head that `useUxHead` (@uxfront/layer-ui) and Docus's `useSeo`
 * write, since both live outside the app (audit findings O2, S1, S2 and S3):
 *
 * - `twitter:title` and `twitter:description` from the Open Graph tags, and an
 *   `og:image:alt` for an image that has none (the docs' generated cards).
 * - The homepage's Organization becomes its graph, and the docs' Article a
 *   TechArticle whose breadcrumbs link pages (app/lib/structured-data.ts).
 *
 * An Unhead hook rather than copies of Docus's page and `useSeo`, which would
 * drift with every Docus update: this reads the tags they write, whatever their
 * code, and `check:seo` fails if their shape changes under it. It runs on the
 * server and the client alike, so hydration and client-side navigation keep
 * the same tags.
 */
export default defineNuxtPlugin((nuxtApp) => {
	const head = injectHead();

	// nuxt-og-image sets og:image on the server only: Docus defines it once, as
	// its page hydrates, and its client code skips hydration. So the server puts
	// each docs page's image in the page's payload, which the client loads as it
	// hydrates or navigates to the page, and the TechArticle takes it from there.
	// The client's JSON-LD must match the server's to the byte, or Unhead keeps
	// the server's block and adds a second one. Images seen on the client stay
	// here, keyed by page URL, so Back finds them too.
	const images = new Map<string, string>();
	let rendered: PageImage | undefined;
	if (import.meta.server) {
		// The payload is serialised after `app:rendered` and the head only after
		// that, so resolve the head here to read the page's og:image.
		nuxtApp.hook("app:rendered", () => {
			head.render();
			if (rendered) {
				nuxtApp.payload.data[IMAGE] = rendered;
			}
		});
	}
	const loaded = (url: string) => {
		for (const entry of [nuxtApp.payload.data[IMAGE], nuxtApp.static.data[IMAGE]]) {
			if (isPageImage(entry)) {
				images.set(entry.url, entry.image);
			}
		}
		return images.get(url);
	};

	// Low priority, so a page's own tag wins. A placeholder left empty isn't
	// rendered (Unhead drops a meta tag without content).
	head.push({
		meta: [
			{ name: "twitter:title", content: "", [INFER]: "og:title", tagPriority: "low" },
			{ name: "twitter:description", content: "", [INFER]: "og:description", tagPriority: "low" },
			{ property: "og:image:alt", content: "", [INFER]: "og:image:alt", tagPriority: "low" },
		],
	});

	head.use({
		key: "seo-head",
		hooks: {
			"tags:beforeResolve": ({ tags }: { tags: Array<Tag> }) => {
				const placeholders = tags.filter((tag) => typeof tag.props[INFER] === "string");
				const meta = (key: string) =>
					tags.find(
						(tag) => tag.tag === "meta" && !placeholders.includes(tag) && metaKey(tag) === key,
					)?.props.content as string | undefined;

				for (const tag of placeholders) {
					const source = tag.props[INFER] as string;
					delete tag.props[INFER];
					if (source !== "og:image:alt") {
						tag.props.content = meta(source);
					} else if (meta("og:image") && !meta("og:image:alt") && meta("og:title")) {
						tag.props.content = `${meta("og:title")}, a page of the Unframework docs`;
					}
				}
			},

			"tags:resolve": ({ tags }: { tags: Array<Tag> }) => {
				// nuxt-og-image makes the URL absolute only as the tags render.
				const og = tags.find((tag) => tag.tag === "meta" && metaKey(tag) === "og:image")?.props
					.content as string | undefined;
				const image = og?.startsWith("/") ? `${SITE_URL}${og}` : og;

				for (const tag of tags) {
					if (tag.tag !== "script" || tag.props.type !== "application/ld+json") {
						continue;
					}
					const block = parse(tag.innerHTML);
					if (!block) {
						continue;
					}

					let rewritten: Record<string, unknown> | undefined;
					if (block["@type"] === "Organization") {
						rewritten = homeGraph(typeof block.description === "string" ? block.description : "");
					} else if (block["@type"] === "Article") {
						const url = typeof block.url === "string" ? block.url : "";
						if (import.meta.server && image) {
							rendered = { url, image };
						}
						rewritten = techArticle(block, {
							dateModified: seoData.lastmod[url.slice(SITE_URL.length) || "/"],
							image: image ?? (import.meta.client ? loaded(url) : undefined),
						});
					} else if (block["@type"] === "BreadcrumbList") {
						rewritten = breadcrumbList(block, seoData.sections);
					}
					if (rewritten) {
						tag.innerHTML = JSON.stringify(rewritten);
					}
				}
			},
		},
	});
});

function isPageImage(value: unknown): value is PageImage {
	return (
		typeof value === "object" &&
		value !== null &&
		"url" in value &&
		typeof value.url === "string" &&
		"image" in value &&
		typeof value.image === "string"
	);
}

function metaKey(tag: Tag) {
	return (tag.props.property ?? tag.props.name) as string | undefined;
}

function parse(content: unknown): Record<string, unknown> | undefined {
	if (content && typeof content === "object") {
		return content as Record<string, unknown>;
	}
	if (typeof content !== "string") {
		return undefined;
	}
	try {
		return JSON.parse(content) as Record<string, unknown>;
	} catch {
		return undefined;
	}
}
