import { queryCollection } from "@nuxt/content/server";

import { rawMarkdown } from "../utils/raw-markdown";
import type { RawPage } from "../utils/raw-markdown";

/**
 * Serves `/llms-full.txt` in place of nuxt-llms's route, from the same source
 * markdown as `/raw/<path>.md`: every docs page in the sidebar's order, as
 * written. Nuxt Content's generator rebuilds it from the parsed pages instead,
 * with MDC attribute residue and HTML tables (audit finding A2).
 *
 * Nitro keeps the first handler for a route, and it registers the app's
 * server/ before the modules' handlers. nuxt-llms still adds the route to the
 * prerendered ones.
 */
export default defineEventHandler(async (event) => {
	const pages = (await queryCollection(event, "docs" as never).all()) as Array<RawPage>;
	const documents = await Promise.all(
		pages.filter((page) => !isNavigationPath(page.path)).map((page) => rawMarkdown(page)),
	);

	setHeader(event, "Content-Type", "text/plain; charset=utf-8");
	return documents.join("\n\n");
});
