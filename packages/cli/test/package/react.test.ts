import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { run, tree } from "../helpers.ts";
import { check, consumer, designSystem, inRepository, SOURCE_TREE } from "./helpers.ts";

const packaged = async () => {
  const root = designSystem({
    config: { targets: ["react"], package: { resolveFrom: inRepository("packages/target-react") } },
    frameworks: ["react", "@types/react"],
  });
  const { code, stderr } = await run(root, "build", "--package");
  expect(stderr).toBe("");
  expect(code).toBe(0);
  return root;
};

describe("build --package: React", () => {
  it("builds JS and declarations through tsdown, beside the sheets", async () => {
    const root = await packaged();
    const files = tree(join(root, "dist", "package"));
    expect(Object.keys(files)).toEqual(
      [
        "package.json",
        "react/Card.d.ts",
        "react/Card.js",
        "react/Card.uf.tsx.css",
        "react/CardTitle.d.ts",
        "react/CardTitle.js",
        "react/index.d.ts",
        "react/index.js",
        "react/shared/format.js",
        "react/useToggle.d.ts",
        "react/useToggle.js",
        ...SOURCE_TREE,
      ].toSorted(),
    );
    expect(files["react/Card.js"]).toContain('from "react/jsx-runtime"');
    expect(files["react/Card.js"]).toContain('import "./Card.uf.tsx.css"');
    expect(files["react/Card.js"]).toContain('from "./shared/format.js"');
    expect(JSON.parse(files["package.json"] ?? "").exports["./react"]).toEqual({
      types: "./react/index.d.ts",
      default: "./react/index.js",
    });
  });

  it("types a consumer that imports the subpath, and stops one that misuses it", async () => {
    const root = await packaged();
    const directory = consumer(root, "react", {
      "Consumer.tsx": `import { Card, useToggle } from "demo-ds/react";

export function Consumer() {
  const { on } = useToggle(true);
  return (
    <>
      <Card label={String(on)} />
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

  it("keeps no sheet in a declaration, which a strict consumer would reject", async () => {
    const root = await packaged();
    const files = tree(join(root, "dist", "package"));
    expect(files["react/Card.d.ts"]).not.toContain(".css");
    const directory = consumer(
      root,
      "react",
      {
        "Consumer.tsx":
          'import { Card } from "demo-ds/react";\n\nexport const app = <Card label="Hi" />;\n',
      },
      { skipLibCheck: false },
    );
    const { output } = check("packages/cli", "tsc", ["-p", directory]);
    expect(output).not.toContain("TS2882");
    expect(output).not.toContain("dist/package");
  });

  it("writes the file a build would, with no absolute path and no map", async () => {
    const root = await packaged();
    const files = tree(join(root, "dist", "package"));
    expect(Object.keys(files).filter((file) => file.endsWith(".map"))).toEqual([]);
    for (const contents of Object.values(files)) {
      expect(contents).not.toContain(root);
      expect(contents).not.toContain("sourceMappingURL");
    }
    expect(readFileSync(join(root, "dist", "react", "Card.tsx"), "utf8")).toContain(
      "sourceMappingURL",
    );
  });
});
