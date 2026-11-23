import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { run, tree } from "../helpers.ts";
import { check, consumer, designSystem, inRepository, SOURCE_TREE } from "./helpers.ts";

const packaged = async (under?: string) => {
  const root = designSystem({
    config: {
      targets: ["ember"],
      package: { resolveFrom: inRepository("tests/toolchains/ember") },
    },
    frameworks: ["ember-source", "@glimmer/component", "@glint/template"],
    frameworksFrom: "tests/toolchains/ember",
    ...(under ? { under } : {}),
  });
  const { code, stderr } = await run(root, "build", "--package");
  expect(stderr).toBe("");
  expect(code).toBe(0);
  return root;
};

describe("build --package: Ember", () => {
  it("builds a v2 addon: JS whose templates the app compiles, with Glint's declarations", async () => {
    const root = await packaged();
    const files = tree(join(root, "dist", "package"));
    expect(Object.keys(files)).toEqual(
      [
        "package.json",
        "ember/Card.d.ts",
        "ember/Card.js",
        "ember/Card.uf.tsx.css",
        "ember/CardTitle.d.ts",
        "ember/CardTitle.js",
        "ember/index.d.ts",
        "ember/index.js",
        "ember/shared/format.d.ts",
        "ember/shared/format.js",
        "ember/useToggle.d.ts",
        "ember/useToggle.js",
        ...SOURCE_TREE,
      ].toSorted(),
    );
    // The app's template compiler compiles each template, as it does a v2 addon's.
    expect(files["ember/CardTitle.js"]).toContain('from "@ember/template-compilation"');
    expect(files["ember/CardTitle.js"]).toContain("precompileTemplate");
    // Each relative import names the compiled module, and the decorators are lowered inline.
    expect(files["ember/Card.js"]).toContain('from "./CardTitle.js"');
    expect(files["ember/Card.js"]).toContain('import "./Card.uf.tsx.css"');
    expect(files["ember/useToggle.js"]).not.toContain("@tracked");
    expect(files["ember/useToggle.js"]).not.toContain("decorator-transforms");
    expect(files["ember/index.d.ts"]).not.toContain(".gts");
    const manifest = JSON.parse(files["package.json"] ?? "");
    expect(manifest.exports["./ember"]).toEqual({
      types: "./ember/index.d.ts",
      default: "./ember/index.js",
    });
    expect(manifest.peerDependencies).toMatchObject({
      "ember-source": ">=7.4 <8",
      "@glimmer/component": "^2.0.0",
    });
  });

  it.each(["R&D", "C++"])("gives the same package under a directory named %s", async (under) => {
    const expected = tree(join(await packaged(), "dist", "package"));
    expect(tree(join(await packaged(under), "dist", "package"))).toEqual(expected);
  });

  it("types a consumer's template that invokes a component, and stops one that misuses it", async () => {
    const root = await packaged();
    const directory = consumer(root, "ember", {
      "Consumer.gts": `import { Card } from "demo-ds/ember";

export const Good = <template><Card @label="Docs" /></template>;
export const Bad = <template>
  {{! @glint-expect-error label is a string. }}
  <Card @label={{1}} />
</template>;
`,
    });
    const { code, output } = check("tests/toolchains/ember", "ember-tsc", [
      "--noEmit",
      "-p",
      join(directory, "tsconfig.json"),
    ]);
    expect(output).toBe("");
    expect(code).toBe(0);
  });
});
