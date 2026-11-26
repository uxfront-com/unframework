import { queryCollection } from "@nuxt/content/server";

import { rawMarkdown } from "../utils/raw-markdown";
import type { RawPage } from "../utils/raw-markdown";

/**
 * Serves `/raw/<path>.md`, the markdown copy of a docs page or a changelog
 * entry, from the page's own source file (`rawMarkdown`). Agents read these
 * files (so does "Copy page"), so they get the markdown as written.
 *
 * Runs before Nuxt Content's route, which still answers for anything that is
 * neither (returning `undefined` hands the request on).
 */
export default defineEventHandler(async (event) => {
	const match = event.path.match(/^\/raw(\/.+?)(?:\/index)?\.md$/);
	if (!match?.[1]) {
		return undefined;
	}

	const path = match[1];
	const page = (
		path.startsWith("/changelog/")
			? await queryCollection(event, "changelog").path(path).first()
			: await queryCollection(event, "docs" as never)
					.path(path)
					.first()
	) as RawPage | null;
	if (!page) {
		return undefined;
	}

	setHeader(event, "Content-Type", "text/markdown; charset=utf-8");
	return rawMarkdown(page);
});
