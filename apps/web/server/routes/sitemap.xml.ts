import { queryCollection } from "#imports";

// Replaces Docus's sitemap, which lists only its `docs` and `landing` collections.
// The homepage is app/pages/index.vue, not a landing page, so Docus leaves / out.
interface DocsPage {
  path: string;
  meta: { sitemap?: boolean; modifiedAt?: unknown };
}

export default defineEventHandler(async (event) => {
  const siteUrl = useRuntimeConfig(event).public.siteUrl;
  const urls: { loc: string; lastmod?: string }[] = [{ loc: "/" }];

  // The docs collection is defined in the Docus layer, so the app's types don't know it.
  const queryDocs = queryCollection as unknown as (
    event: unknown,
    collection: "docs",
  ) => { all: () => Promise<DocsPage[]> };

  for (const page of await queryDocs(event, "docs").all()) {
    const { meta } = page;
    // Skip pages with `sitemap: false` and the .navigation files.
    if (meta.sitemap === false || page.path.endsWith("/.navigation")) continue;
    const lastmod = typeof meta.modifiedAt === "string" ? meta.modifiedAt.split("T")[0] : undefined;
    urls.push({ loc: page.path, lastmod });
  }

  const entries = urls.map(({ loc, lastmod }) =>
    [
      "  <url>",
      `    <loc>${escapeXml(siteUrl + loc)}</loc>`,
      ...(lastmod ? [`    <lastmod>${escapeXml(lastmod)}</lastmod>`] : []),
      "  </url>",
    ].join("\n"),
  );

  setResponseHeader(event, "content-type", "application/xml");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>`;
});

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
