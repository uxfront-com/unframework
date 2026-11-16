import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import {
  AI_CRAWLERS,
  NOINDEX_HOSTS,
  checkSite,
  format,
  headerNoindex,
  pagePath,
} from "./check-seo.ts";

const SITE = "https://unframework.dev";
const DOCS = "/docs/components/props";

/** A PNG with just its signature and IHDR chunk, enough for its size. */
function png(width: number, height: number) {
  const bytes = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes);
  bytes.write("IHDR", 12, "latin1");
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

function page({
  path,
  title,
  description,
  jsonLd,
}: {
  path: string;
  title: string;
  description: string;
  jsonLd: unknown[];
}) {
  const url = `${SITE}${path}`;
  const image = `${SITE}/og${path === "/" ? "/home" : path}.png`;
  return `<!DOCTYPE html><html lang="en"><head>
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${title}"><meta property="og:description" content="${description}">
<meta property="og:url" content="${url}"><meta property="og:type" content="article">
<meta property="og:image" content="${image}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}"><meta name="twitter:image" content="${image}">
${jsonLd.map((block) => `<script type="application/ld+json">${JSON.stringify(block)}</script>`).join("")}
</head><body><h1>${title}</h1><script>window.x = "<h1>not a heading</h1>"</script></body></html>`;
}

function writeSite(dist: string) {
  const write = (file: string, content: string | Buffer) => {
    mkdirSync(dirname(join(dist, file)), { recursive: true });
    writeFileSync(join(dist, file), content);
  };
  write(
    "index.html",
    page({
      path: "/",
      title: "Unframework - Compile UI components",
      description:
        "Write UI components once and compile them to native React, Vue, Svelte, Angular and more.",
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "WebSite" },
            { "@type": "SoftwareSourceCode" },
            { "@type": "Organization", name: "UXFront" },
          ],
        },
      ],
    }),
  );
  write(
    `${DOCS.slice(1)}.html`,
    page({
      path: DOCS,
      title: "Props - Unframework",
      description:
        "A component takes its props as one typed parameter, and every framework declares them its own way.",
      jsonLd: [
        { "@type": "TechArticle", dateModified: "2026-11-04", image: `${SITE}/og${DOCS}.png` },
        {
          "@type": "BreadcrumbList",
          itemListElement: [{ item: `${SITE}/` }, { item: `${SITE}${DOCS}` }],
        },
      ],
    }),
  );
  write("og/home.png", png(1200, 630));
  write(`og${DOCS}.png`, png(1200, 630));
  write(
    "404.html",
    `<html lang="en"><head><meta name="robots" content="noindex, nofollow"></head><body></body></html>`,
  );
  write("200.html", `<html lang="en"><head></head><body></body></html>`);
  write(
    "docs.html",
    `<html><head><meta http-equiv="refresh" content="0; url=${DOCS}"></head></html>`,
  );
  write(
    "sitemap.xml",
    `<urlset><url><loc>${SITE}/</loc><lastmod>2026-11-15</lastmod></url><url><loc>${SITE}${DOCS}</loc><lastmod>2026-11-04</lastmod></url></urlset>`,
  );
  write(
    "robots.txt",
    [
      "User-agent: *",
      "Allow: /",
      ...AI_CRAWLERS.flatMap((agent) => ["", `User-agent: ${agent}`, "Allow: /"]),
      "",
      `Sitemap: ${SITE}/sitemap.xml`,
    ].join("\n"),
  );
  write(
    "llms.txt",
    `# Unframework\n\n> The compiler.\n\n- [Props](${SITE}/raw${DOCS}.md): Props.\n`,
  );
  write("llms-full.txt", "# Props\n\n> Props.\n\n| a | b |\n| - | - |\n| `<tr>` | x |\n");
  write("_redirects", "/docs\t/docs/getting-started/introduction\t301\n");
  write(
    "_headers",
    [
      "/200",
      "  X-Robots-Tag: noindex",
      "/*",
      "  X-Frame-Options: DENY",
      ...NOINDEX_HOSTS.flatMap((host) => [host, "  X-Robots-Tag: noindex"]),
    ].join("\n"),
  );
}

await test("check:seo", async (t) => {
  let dist: string;
  const edit = (file: string, change: (content: string) => string) =>
    writeFileSync(join(dist, file), change(readFileSync(join(dist, file), "utf8")));
  const problems = () => checkSite(dist).problems.map(({ target, rule }) => `${target} ${rule}`);

  t.beforeEach(() => {
    dist = mkdtempSync(join(tmpdir(), "check-seo-"));
    writeSite(dist);
  });
  t.afterEach(() => rmSync(dist, { recursive: true, force: true }));

  await t.test("passes a site that keeps every rule, and excludes the pages it should", () => {
    const report = checkSite(dist);
    assert.deepEqual(report.problems, []);
    assert.match(format(report), /2 pages and 6 files checked, 0 problems$/);
  });

  await t.test("names the page of a description cut to 50 characters", () => {
    edit(`${DOCS.slice(1)}.html`, (html) =>
      html.replace(/(name="description" content=")([^"]{50})[^"]*/, "$1$2"),
    );
    assert.deepEqual(problems(), [`${DOCS} description`]);
  });

  await t.test("reads a quoted > inside an attribute as part of the value", () => {
    edit(`${DOCS.slice(1)}.html`, (html) =>
      html.replace(
        'name="description" content="A component',
        'name="description" content="A <component is> component',
      ),
    );
    assert.deepEqual(problems(), []);
  });

  await t.test("names the page with a second <h1>, and ignores one in a script", () => {
    edit(`${DOCS.slice(1)}.html`, (html) => html.replace("<body>", "<body><h1>Again</h1>"));
    assert.deepEqual(problems(), [`${DOCS} h1`]);
  });

  await t.test("names a page missing from the sitemap", () => {
    edit("sitemap.xml", (xml) => xml.replace(/<url><loc>[^<]*\/props<\/loc>.*?<\/url>/, ""));
    assert.ok(problems().includes(`${DOCS} sitemap`));
  });

  await t.test("names the page of a JSON-LD block that doesn't parse", () => {
    edit(`${DOCS.slice(1)}.html`, (html) =>
      html.replace('{"@type":"TechArticle"', '{"@type":"TechArticle",,'),
    );
    assert.deepEqual(problems(), [`${DOCS} json-ld`, `${DOCS} json-ld`]);
  });

  await t.test(
    "requires the breadcrumbs to link sitemap pages, and the article's date to be the sitemap's",
    () => {
      edit(`${DOCS.slice(1)}.html`, (html) =>
        html
          .replace(`{"item":"${SITE}/"}`, `{"item":"${SITE}/docs/components"}`)
          .replace("2026-11-04", "2026-01-01"),
      );
      assert.deepEqual(problems(), [`${DOCS} json-ld`, `${DOCS} json-ld`]);
    },
  );

  await t.test("fails an Organization named Unframework on the homepage", () => {
    edit("index.html", (html) => html.replace('"name":"UXFront"', '"name":"Unframework"'));
    assert.deepEqual(problems(), ["/ json-ld"]);
  });

  await t.test("checks the Open Graph image's file and size", () => {
    writeFileSync(join(dist, `og${DOCS}.png`), png(1200, 600));
    assert.deepEqual(problems(), [`${DOCS} open-graph`]);
    rmSync(join(dist, `og${DOCS}.png`));
    assert.deepEqual(problems(), [`${DOCS} open-graph`]);
  });

  await t.test("fails a noindex page in the sitemap, and a duplicate title", () => {
    edit(`${DOCS.slice(1)}.html`, (html) =>
      html.replace(
        "<title>Props - Unframework",
        '<meta name="robots" content="noindex"><title>Unframework - Compile UI components',
      ),
    );
    assert.deepEqual(problems().sort(), [`${DOCS} robots`, `${DOCS} title`, "/ title"].sort());
  });

  await t.test(
    "fails a temporary redirect, and a rule with no status, which Cloudflare sends as 302",
    () => {
      edit("_redirects", (rules) => `${rules}/a\t/b\t307\n/c\t/d\n`);
      assert.deepEqual(problems(), ["_redirects redirects", "_redirects redirects"]);
    },
  );

  await t.test("requires the host rules, robots.txt's groups and llms.txt's summary", () => {
    edit("_headers", (rules) =>
      rules.replace("https://www.unframework.dev/*", "https://www.example.com/*"),
    );
    edit("robots.txt", (robots) =>
      robots.replace("User-agent: GPTBot\nAllow: /", "User-agent: GPTBot\nDisallow: /"),
    );
    edit("llms.txt", (llms) => llms.replace("> The compiler.", "The compiler."));
    edit("llms-full.txt", (full) => `${full}{rel="&#x22;nofollow&#x22;"}\n<table>\n`);
    assert.deepEqual(problems(), [
      "robots.txt robots",
      "llms.txt llms",
      "llms-full.txt llms",
      "llms-full.txt llms",
      "_headers headers",
    ]);
  });

  await t.test("fails a missing or invalid lastmod", () => {
    edit("sitemap.xml", (xml) =>
      xml.replace("2026-11-15", "2026-02-30").replace("<lastmod>2026-11-04</lastmod>", ""),
    );
    assert.deepEqual(problems(), ["sitemap.xml lastmod", "sitemap.xml lastmod"]);
  });
});

await test("pagePath", async (t) => {
  await t.test("maps files to the paths Cloudflare serves them at", () => {
    assert.equal(pagePath("index.html"), "/");
    assert.equal(pagePath("docs/a.html"), "/docs/a");
    assert.equal(pagePath("docs/b/index.html"), "/docs/b");
  });
});

await test("headerNoindex", async (t) => {
  const rules = [
    { pattern: "/200", headers: ["X-Robots-Tag: noindex"] },
    { pattern: "/_nuxt/*", headers: ["X-Robots-Tag: noindex"] },
    { pattern: "https://www.unframework.dev/*", headers: ["X-Robots-Tag: noindex"] },
  ];

  await t.test("matches host-less rules only, since the host rules match every path", () => {
    assert.equal(headerNoindex(rules, "/200"), "/200");
    assert.equal(headerNoindex(rules, "/_nuxt/a.js"), "/_nuxt/*");
    assert.equal(headerNoindex(rules, "/docs/components/props"), undefined);
  });
});
