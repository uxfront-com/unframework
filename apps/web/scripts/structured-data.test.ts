import assert from "node:assert/strict";
import { test } from "node:test";

import { breadcrumbList, homeGraph, techArticle } from "../app/lib/structured-data.ts";

const SITE = "https://unframework.dev";
const sections = {
  "/docs/getting-started": "/docs/getting-started/introduction",
  "/docs/components": "/docs/components/props",
};

await test("homeGraph", async (t) => {
  await t.test("describes the site and the software, published by UXFront, not Unframework", () => {
    const graph = homeGraph("The compiler.")["@graph"] as Record<string, unknown>[];
    assert.deepEqual(
      graph.map((node) => [node["@type"], node.name]),
      [
        ["WebSite", "Unframework"],
        ["SoftwareSourceCode", "Unframework"],
        ["Organization", "UXFront"],
      ],
    );
    const [website, software, organization] = graph;
    assert.deepEqual(website!.publisher, { "@id": organization!["@id"] });
    assert.deepEqual(website!.about, { "@id": software!["@id"] });
    assert.equal(software!.codeRepository, "https://github.com/uxfront-com/unframework");
    assert.equal(software!.programmingLanguage, "TypeScript");
  });
});

await test("techArticle", async (t) => {
  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Props",
    url: `${SITE}/docs/components/props`,
    publisher: { "@type": "Organization", name: "Unframework" },
  };

  await t.test("turns Docus's Article into a TechArticle that points at the homepage's ids", () => {
    const result = techArticle(article, { dateModified: "2026-11-04", image: `${SITE}/og.png` });
    assert.equal(result["@type"], "TechArticle");
    assert.equal(result.headline, "Props");
    assert.equal(result.dateModified, "2026-11-04");
    assert.equal(result.image, `${SITE}/og.png`);
    assert.equal(
      (result.publisher as Record<string, unknown>)["@id"],
      "https://uxfront.com/#organization",
    );
    assert.equal((result.publisher as Record<string, unknown>).name, "UXFront");
    assert.equal((result.isPartOf as Record<string, unknown>)["@id"], `${SITE}/#website`);
  });

  await t.test("leaves out a date or an image it doesn't have", () => {
    const result = techArticle(article, {});
    assert.equal("dateModified" in result, false);
    assert.equal("image" in result, false);
  });
});

await test("breadcrumbList", async (t) => {
  const list = (...items: [string, string][]) => ({
    "@type": "BreadcrumbList",
    itemListElement: items.map(([name, path], index) => ({
      "@type": "ListItem",
      position: index + 1,
      name,
      item: `${SITE}${path}`,
    })),
  });
  const items = (result: Record<string, unknown>) =>
    (result.itemListElement as { position: number; name: string; item: string }[]).map(
      ({ position, name, item }) => `${position} ${name} ${item.slice(SITE.length)}`,
    );

  await t.test("starts from the homepage and links a section's first page", () => {
    const result = breadcrumbList(
      list(["Components", "/docs/components"], ["State", "/docs/components/state"]),
      sections,
    );
    assert.deepEqual(items(result), [
      "1 Unframework /",
      "2 Components /docs/components/props",
      "3 State /docs/components/state",
    ]);
  });

  await t.test("drops the section on its own first page", () => {
    const result = breadcrumbList(
      list(
        ["Getting started", "/docs/getting-started"],
        ["Introduction", "/docs/getting-started/introduction"],
      ),
      sections,
    );
    assert.deepEqual(items(result), [
      "1 Unframework /",
      "2 Introduction /docs/getting-started/introduction",
    ]);
  });

  await t.test("copes with a list without items", () => {
    assert.deepEqual(items(breadcrumbList({ "@type": "BreadcrumbList" }, sections)), [
      "1 Unframework /",
    ]);
  });
});
