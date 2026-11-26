// The one SEO rule only this site needs, which `@uxfront/site-checks` runs as an extra rule
// (site-checks.config.ts).

import { join } from "node:path";

import type { ExtraRule } from "@uxfront/site-checks";

/** The payload key that carries a docs page's og:image to the client (app/plugins/seo-head.ts). */
export const PAYLOAD_IMAGE = "seo-head:image";

/**
 * A docs page's `_payload.json` carries its og:image, which the client gives the
 * TechArticle after a client-side navigation, since nuxt-og-image doesn't set
 * og:image again on the client.
 */
export const payload: ExtraRule = {
	id: "payload",
	check({ pages, read, report }) {
		for (const page of pages) {
			const image = page.meta("og:image")[0];
			if (!page.path.startsWith("/docs/") || !image) {
				continue;
			}
			const text = read(join(page.path, "_payload.json"));
			if (text === undefined) {
				report(page.path, "no _payload.json");
				continue;
			}
			const entry = payloadImage(text);
			if (entry?.url !== page.loc || entry.image !== image) {
				report(
					page.path,
					"_payload.json doesn't carry the og:image, so the TechArticle loses it after a client-side navigation",
				);
			}
		}
	},
};

/**
 * The `{ url, image }` under `data[PAYLOAD_IMAGE]` in a payload, which devalue
 * flattens into one array whose values point at each other by index.
 */
function payloadImage(text: string): { url?: unknown; image?: unknown } | undefined {
	let values: unknown;
	try {
		values = JSON.parse(text);
	} catch {
		return undefined;
	}
	if (!Array.isArray(values)) {
		return undefined;
	}
	const at = (index: unknown): unknown => {
		let value: unknown = typeof index === "number" ? values[index] : undefined;
		// A reducer wraps a value as its name and its index, like `["ShallowReactive", 2]`.
		for (let depth = 0; depth < 8 && isReduced(value); depth++) {
			value = values[value[1]];
		}
		return value;
	};
	const field = (value: unknown, key: string) =>
		value && typeof value === "object" && key in value
			? at((value as Record<string, unknown>)[key])
			: undefined;
	const entry = field(field(at(0), "data"), PAYLOAD_IMAGE);
	return entry === undefined
		? undefined
		: { url: field(entry, "url"), image: field(entry, "image") };
}

const isReduced = (value: unknown): value is [string, number] =>
	Array.isArray(value) &&
	value.length === 2 &&
	typeof value[0] === "string" &&
	typeof value[1] === "number";
