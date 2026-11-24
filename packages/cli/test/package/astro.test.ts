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

  // A root conditional takes `scopeAttributes`, which the component imports from the tree's
  // `_unframework/` (ADR-0121): the package ships the module beside it, and no entry exports it.
  it("ships the shared helper modules the components import", async () => {
    const root = designSystem({
      config: { targets: ["astro"] },
      files: {
        "src/Notice.uf.tsx": `export default function Notice(props: { open: boolean }) {
  return <>{props.open ? <p>Open</p> : <p>Closed</p>}</>;
}
`,
      },
    });
    const { code, stderr } = await run(root, "build", "--package");
    expect(stderr).toBe("");
    expect(code).toBe(0);
    const files = tree(join(root, "dist", "package"));
    expect(Object.keys(files).filter((path) => path.includes("_unframework/"))).toEqual([
      "astro/_unframework/scopeAttributes.ts",
    ]);
    expect(files["astro/Notice.astro"]).toContain(
      'import { scopeAttributes } from "./_unframework/scopeAttributes";',
    );
    expect(files["astro/_unframework/scopeAttributes.ts"]).toMatch(
      /^export function scopeAttributes\(/m,
    );
    expect(JSON.stringify(JSON.parse(files["package.json"] ?? "").exports)).not.toContain(
      "_unframework",
    );
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
