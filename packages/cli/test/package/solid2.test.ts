// The solid2 packager (ADR-0102): the package's `./solid2` subpath, compiled by Solid 2's own
// compiler, which resolves through `package.resolveFrom`, as every packager's tools do.
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { run, tree } from "../helpers.ts";
import { check, consumer, designSystem, inRepository, SOURCE_TREE } from "./helpers.ts";

/** A design system packaged for `solid@2`, and for `solid@1` beside it when `both`. */
// A title with a class bound to a value, so it imports the shared `cx` (ADR-0121).
const TITLE = `export function CardTitle(props: { label: string }) {
  return <h2 class={["card-title", { long: props.label.length > 8 }]}>{props.label}</h2>;
}
`;

const packaged = async (both = false) => {
  const root = designSystem({
    config: {
      targets: both ? ["solid@1", "solid@2"] : ["solid@2"],
      package: {
        resolveFrom: {
          ...(both ? { solid: inRepository("packages/target-solid") } : {}),
          solid2: inRepository("packages/target-solid2"),
        },
      },
    },
    frameworks: ["solid-js", "@solidjs/web"],
    frameworksFrom: "tests/toolchains/solid2",
    files: { "src/CardTitle.uf.tsx": TITLE },
  });
  const { code, stderr } = await run(root, "build", "--package");
  expect(stderr).toBe("");
  expect(code).toBe(0);
  return root;
};

describe("build --package: solid@2", () => {
  it("builds solid@2's compiled JS, declarations, and preserved JSX under ./solid2", async () => {
    const files = tree(join(await packaged(), "dist", "package"));
    expect(Object.keys(files)).toEqual(
      [
        "package.json",
        "solid2/Card.d.ts",
        "solid2/Card.js",
        "solid2/Card.jsx",
        "solid2/Card.uf.tsx.css",
        "solid2/CardTitle.d.ts",
        "solid2/CardTitle.js",
        "solid2/CardTitle.jsx",
        // The shared helper modules the outputs import (ADR-0121), which no entry exports.
        "solid2/_unframework/createState.js",
        "solid2/_unframework/createState.jsx",
        "solid2/_unframework/cx.js",
        "solid2/_unframework/cx.jsx",
        "solid2/index.d.ts",
        "solid2/index.js",
        "solid2/index.jsx",
        "solid2/shared/format.js",
        "solid2/shared/format.jsx",
        "solid2/useToggle.d.ts",
        "solid2/useToggle.js",
        "solid2/useToggle.jsx",
        ...SOURCE_TREE,
      ].toSorted(),
    );
    // Solid 2's compiler ran on the JS, for @solidjs/web, and left the JSX for the consumer's.
    expect(files["solid2/CardTitle.js"]).toContain('from "@solidjs/web"');
    expect(files["solid2/CardTitle.js"]).not.toContain("solid-js/web");
    expect(files["solid2/CardTitle.js"]).toContain("template");
    expect(files["solid2/CardTitle.jsx"]).toContain("<h2");
    expect(files["solid2/CardTitle.jsx"]).not.toContain("@solidjs/web");
    // Each output imports a helper from the package's own `_unframework/`, on its side of the
    // condition, and declares none of its own.
    expect(files["solid2/CardTitle.js"]).toContain('from "./_unframework/cx.js"');
    expect(files["solid2/CardTitle.js"]).not.toMatch(/function cx\b/);
    expect(files["solid2/CardTitle.jsx"]).toContain('from "./_unframework/cx.jsx"');
    expect(files["solid2/CardTitle.jsx"]).not.toMatch(/function cx\b/);
    expect(files["solid2/useToggle.js"]).toContain('from "./_unframework/createState.js"');
    expect(files["solid2/useToggle.js"]).not.toMatch(/function createState\b/);
    expect(files["solid2/useToggle.jsx"]).toContain('from "./_unframework/createState.jsx"');
    expect(files["solid2/useToggle.jsx"]).not.toMatch(/function createState\b/);
    expect(files["solid2/_unframework/cx.js"]).toMatch(/^export \{ cx \};$/m);
    expect(files["solid2/_unframework/cx.jsx"]).toMatch(/^export \{ cx \};$/m);
    expect(JSON.stringify(JSON.parse(files["package.json"] ?? "").exports)).not.toContain(
      "_unframework",
    );
    const manifest = JSON.parse(files["package.json"] ?? "");
    expect(manifest.exports["./solid2"]).toEqual({
      types: "./solid2/index.d.ts",
      solid: "./solid2/index.jsx",
      default: "./solid2/index.js",
    });
    expect(manifest.peerDependencies).toEqual({ "solid-js": "^2.0.0", "@solidjs/web": "^2.0.0" });
  });

  it("joins solid-js's ranges where the package has solid@1 and solid@2", async () => {
    const files = tree(join(await packaged(true), "dist", "package"));
    const manifest = JSON.parse(files["package.json"] ?? "");
    expect(Object.keys(manifest.exports)).toEqual(expect.arrayContaining(["./solid", "./solid2"]));
    expect(manifest.peerDependencies).toEqual({
      "solid-js": "^1.9.0 || ^2.0.0",
      "@solidjs/web": "^2.0.0",
    });
    expect(files["solid/CardTitle.js"]).toContain('from "solid-js/web"');
    expect(files["solid2/CardTitle.js"]).toContain('from "@solidjs/web"');
  });

  it("types a consumer that imports the solid2 subpath, and stops one that misuses it", async () => {
    const root = await packaged();
    const directory = consumer(root, "solid2", {
      "Consumer.tsx": `import { Card, useToggle } from "demo-ds/solid2";

export function Consumer() {
  const { on } = useToggle(true);
  return (
    <>
      <Card label={String(on())} />
      {/* @ts-expect-error label is a string. */}
      <Card label={1} />
    </>
  );
}
`,
    });
    const { code, output } = check("packages/cli", "tsc", ["-p", directory]);
    expect(output).toBe("");
    expect(code).toBe(0);
  });
});
