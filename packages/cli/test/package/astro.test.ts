import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { run, tree } from "../helpers.ts";
import { check, consumer, designSystem, SOURCE_TREE } from "./helpers.ts";

describe("build --package: Astro", () => {
  it("ships the emitted sources, which need no packager", async () => {
    const root = designSystem({ config: { targets: ["astro"] } });
    const { code, stderr } = await run(root, "build", "--package");
    expect(stderr).toBe("");
    expect(code).toBe(0);
    const files = tree(join(root, "dist", "package"));
    expect(Object.keys(files)).toEqual(
      [
        "astro/Card.astro",
        "astro/Card.uf.tsx.css",
        "astro/CardTitle.astro",
        "astro/index.ts",
        "astro/shared/format.ts",
        "astro/useToggle.ts",
        "package.json",
        ...SOURCE_TREE,
      ].toSorted(),
    );
    expect(JSON.parse(files["package.json"] ?? "").exports["./astro"]).toBe("./astro/index.ts");
    expect(files["astro/Card.astro"]).toEqual(tree(join(root, "dist", "astro"))["Card.astro"]);
  });

  it("types a consumer that imports the subpath, and stops one that misuses it", async () => {
    const root = designSystem({ config: { targets: ["astro"] } });
    expect((await run(root, "build", "--package")).code).toBe(0);
    const directory = consumer(root, "astro", {
      "Consumer.astro": `---
import { Card, useToggle } from "demo-ds/astro";

const { on } = useToggle(true);
// @ts-expect-error label is a string.
const misused: Parameters<typeof Card>[0] = { label: 1 };
---

<Card label={String(on)} {...misused} />
`,
    });
    const { code, output } = check("tests/toolchains/astro", "astro", [
      "check",
      "--root",
      directory,
      "--noSync",
      "--minimumFailingSeverity",
      "warning",
    ]);
    expect(output).toContain("0 errors");
    expect(code).toBe(0);
  });
});
