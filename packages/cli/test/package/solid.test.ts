import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { run, tree } from "../helpers.ts";
import { check, consumer, designSystem, inRepository, SOURCE_TREE } from "./helpers.ts";

const packaged = async () => {
  const root = designSystem({
    config: { targets: ["solid"], package: { resolveFrom: inRepository("packages/target-solid") } },
    frameworks: ["solid-js"],
  });
  const { code, stderr } = await run(root, "build", "--package");
  expect(stderr).toBe("");
  expect(code).toBe(0);
  return root;
};

describe("build --package: Solid", () => {
  it("builds compiled JS, declarations, and preserved JSX under the solid condition", async () => {
    const root = await packaged();
    const files = tree(join(root, "dist", "package"));
    expect(Object.keys(files)).toEqual(
      [
        "package.json",
        "solid/Card.d.ts",
        "solid/Card.js",
        "solid/Card.jsx",
        "solid/Card.uf.tsx.css",
        "solid/CardTitle.d.ts",
        "solid/CardTitle.js",
        "solid/CardTitle.jsx",
        "solid/index.d.ts",
        "solid/index.js",
        "solid/index.jsx",
        "solid/shared/format.js",
        "solid/shared/format.jsx",
        "solid/useToggle.d.ts",
        "solid/useToggle.js",
        "solid/useToggle.jsx",
        ...SOURCE_TREE,
      ].toSorted(),
    );
    // Solid's compiler ran on the JS, and left the JSX for the consumer's.
    expect(files["solid/CardTitle.js"]).toContain('from "solid-js/web"');
    expect(files["solid/CardTitle.js"]).not.toContain("<h2>{");
    expect(files["solid/CardTitle.jsx"]).toContain("<h2");
    expect(files["solid/CardTitle.jsx"]).not.toContain("solid-js/web");
    // Each stays on its own side of the condition.
    expect(files["solid/Card.js"]).toContain('from "./CardTitle.js"');
    expect(files["solid/Card.jsx"]).toContain('from "./CardTitle.jsx"');
    expect(files["solid/Card.jsx"]).toContain('import "./Card.uf.tsx.css"');
    const { exports } = JSON.parse(files["package.json"] ?? "");
    expect(exports["./solid"]).toEqual({
      types: "./solid/index.d.ts",
      solid: "./solid/index.jsx",
      default: "./solid/index.js",
    });
    // Conditions match in order: `default` before `solid` would hide it.
    expect(Object.keys(exports["./solid"])).toEqual(["types", "solid", "default"]);
  });

  it("types a consumer that imports the subpath, and stops one that misuses it", async () => {
    const root = await packaged();
    const directory = consumer(root, "solid", {
      "Consumer.tsx": `import { Card, useToggle } from "demo-ds/solid";

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
