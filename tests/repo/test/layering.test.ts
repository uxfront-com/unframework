import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { importsOf, packageOf, packages, root, sourceFiles } from "./workspace.ts";

/**
 * The package layers, lowest first (plan §5.2). A package never imports one above it, nor one
 * on its own layer. Packages not listed yet must be added here when they are created.
 */
const LAYERS: readonly (readonly string[])[] = [
  ["@unframework.dev/ir", "@unframework.dev/diagnostics"],
  ["@unframework.dev/parser", "@unframework.dev/type-oracle"],
  ["@unframework.dev/type-oracle-tsgo", "@unframework.dev/codegen"],
  ["@unframework.dev/analyzer"],
  [
    "@unframework.dev/target-react",
    "@unframework.dev/target-vue",
    "@unframework.dev/target-svelte",
    "@unframework.dev/target-solid",
    "@unframework.dev/target-angular",
    "@unframework.dev/target-qwik",
    "@unframework.dev/target-astro",
  ],
  ["@unframework.dev/compiler"],
  ["@unframework.dev/unplugin", "@unframework.dev/cli", "@unframework.dev/language-tools"],
  ["@unframework.dev/testing"],
  ["@unframework.dev/visual", "@unframework.dev/mcp", "create-unframework"],
  // The umbrella: the authoring API, plus tooling re-exported under subpaths.
  ["unframework"],
];

const layerOf = new Map(
  LAYERS.flatMap((names, layer) => names.map((name) => [name, layer] as const)),
);
const isWorkspace = (name: string) =>
  name === "unframework" || name.startsWith("@unframework.dev/") || name === "create-unframework";

describe("layering", () => {
  const all = packages();

  it("knows the layer of every package", () => {
    expect(all.map((pkg) => pkg.manifest.name).filter((name) => !layerOf.has(name))).toEqual([]);
  });

  it.each(all.map((pkg) => [pkg.manifest.name as string, pkg] as const))(
    "%s imports no package above it or beside it",
    (name, pkg) => {
      const layer = layerOf.get(name)!;
      const violations = sourceFiles(join(pkg.path, "src"))
        .flatMap(importsOf)
        .filter((record) => {
          const imported = packageOf(record.specifier);
          if (!imported || !isWorkspace(imported) || imported === name) return false;
          return (layerOf.get(imported) ?? Number.POSITIVE_INFINITY) >= layer;
        })
        .map((record) => `${record.file} imports ${record.specifier}`);
      expect(violations).toEqual([]);
    },
  );

  it("keeps each target's main entry to ir and codegen (toolchains are for tests)", () => {
    const violations = all
      .filter((pkg) => pkg.directory.startsWith("target-"))
      .flatMap((pkg) =>
        sourceFiles(join(pkg.path, "src"))
          .filter((file) => !file.includes(`${join(pkg.path, "src", "toolchain")}`))
          .flatMap(importsOf),
      )
      .filter((record) => {
        const imported = packageOf(record.specifier);
        return imported && imported !== "@unframework.dev/ir" && imported !== "@unframework.dev/codegen";
      })
      .map((record) => `${record.file} imports ${record.specifier}`);
    expect(violations).toEqual([]);
  });

  it("imports TypeScript's API only in type-oracle-tsgo and the test toolchains", () => {
    const allowed = ["packages/type-oracle-tsgo/", "tests/toolchains/"];
    const files = [
      ...all.flatMap((pkg) => sourceFiles(join(pkg.path, "src"))),
      ...sourceFiles(join(root, "tests", "integration")),
    ];
    const violations = files
      .flatMap(importsOf)
      .filter((record) => packageOf(record.specifier) === "typescript" && !record.typeOnly)
      .filter((record) => !allowed.some((prefix) => record.file.startsWith(prefix)))
      .map((record) => `${record.file} imports ${record.specifier}`);
    expect(violations).toEqual([]);
  });

  it("finds imports, including re-exports and dynamic imports", () => {
    const records = importsOf(join(root, "packages", "compiler", "src", "index.ts"));
    expect(records.map((record) => record.specifier)).toContain("@unframework.dev/codegen");
  });
});
