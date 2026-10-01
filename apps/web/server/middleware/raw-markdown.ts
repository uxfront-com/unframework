import { readFile } from "node:fs/promises";
import { join } from "node:path";

// The fields read below. Nitro's types don't see the collections Docus defines.
interface DocsPage {
  stem: string;
  extension: string;
  title: string;
  description: string;
}

/**
 * Serves `/raw/<path>.md`, the markdown copy of a docs page, from the page's own
 * source file. Nuxt Content's route rebuilds the markdown from the parsed page
 * and writes every table as HTML, unescaped: a `<button>` in a table cell comes
 * out as a tag, and the file doubles in length. Agents read these files (so does
 * "Copy page"), so they get the markdown as written: the title and description,
 * then the page without its frontmatter.
 *
 * Runs before Nuxt Content's route, which still answers for anything that isn't
 * a docs page (returning `undefined` hands the request on). The site is static:
 * this runs on `pnpm dev` and when the pages are prerendered, both from apps/web.
 */
export default defineEventHandler(async (event) => {
  const match = event.path.match(/^\/raw(\/.+?)(?:\/index)?\.md$/);
  if (!match?.[1]) return undefined;

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a collection Nitro's types don't see
  const page = (await queryCollection(event, "docs" as never)
    .path(match[1])
    .first()) as DocsPage | null;
  if (!page) return undefined;

  const source = await readFile(
    join(process.cwd(), "content", `${page.stem}.${page.extension}`),
    "utf8",
  );
  const body = source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "").trim();

  setHeader(event, "Content-Type", "text/markdown; charset=utf-8");
  return `# ${page.title}\n\n> ${page.description}\n\n${body}\n`;
});
