import { queryCollection } from "@nuxt/content/server";

import { rawMarkdown, type DocsPage } from "../utils/raw-markdown";

/**
 * Serves `/raw/<path>.md`, the markdown copy of a docs page, from the page's own
 * source file (`rawMarkdown`). Agents read these files (so does "Copy page"),
 * so they get the markdown as written.
 *
 * Runs before Nuxt Content's route, which still answers for anything that isn't
 * a docs page (returning `undefined` hands the request on).
 */
export default defineEventHandler(async (event) => {
  const match = event.path.match(/^\/raw(\/.+?)(?:\/index)?\.md$/);
  if (!match?.[1]) {
    return undefined;
  }

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a collection Nitro's types don't see
  const page = (await queryCollection(event, "docs" as never)
    .path(match[1])
    .first()) as DocsPage | null;
  if (!page) {
    return undefined;
  }

  setHeader(event, "Content-Type", "text/markdown; charset=utf-8");
  return rawMarkdown(page);
});
