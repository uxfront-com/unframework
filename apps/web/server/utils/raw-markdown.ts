import { readFile } from "node:fs/promises";
import { join } from "node:path";

// The fields read below. Nitro's types don't see the collections Docus defines.
export interface DocsPage {
  path: string;
  stem: string;
  extension: string;
  title: string;
  description: string;
}

/**
 * A docs page's markdown as written: its title and description, then the page
 * without its frontmatter. Nuxt Content rebuilds markdown from the parsed page
 * instead, and writes every table as unescaped HTML (a `<button>` in a cell
 * comes out as a tag) and link attributes as `{rel="&#x22;nofollow&#x22;"}`.
 *
 * The site is static: this runs on `pnpm dev` and when the pages are
 * prerendered, both from apps/web.
 */
export async function rawMarkdown(page: DocsPage) {
  const source = await readFile(
    join(process.cwd(), "content", `${page.stem}.${page.extension}`),
    "utf8",
  );
  const body = source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "").trim();
  return `# ${page.title}\n\n> ${page.description}\n\n${body}\n`;
}
