import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { packageTemplate } from "../../../scripts/new-package.ts";
import { packages, root } from "./workspace.ts";

interface PackageFiles {
  directory: string;
  read(path: string): string | undefined;
  list(path: string): string[];
}

/** The rules of the package template (plan §5.2); returns the problems found. */
function checkPackage(pkg: PackageFiles): string[] {
  const problems: string[] = [];
  const raw = pkg.read("package.json");
  if (!raw) return ["has no package.json"];
  const manifest = JSON.parse(raw);
  const expect = (condition: unknown, problem: string) => {
    if (!condition) problems.push(problem);
  };

  expect(manifest.type === "module", "is not an ES module package");
  expect(manifest.license === "MIT", "is not MIT-licensed");
  expect(manifest.description, "has no description");
  expect(
    manifest.repository?.directory === `packages/${pkg.directory}`,
    "has a wrong repository.directory",
  );
  expect(manifest.files?.includes("dist"), "does not publish dist");
  expect(manifest.publishConfig?.access === "public", "has no public publishConfig");

  const exportsMap: Record<string, unknown> = manifest.exports ?? {};
  const published: Record<string, unknown> = manifest.publishConfig?.exports ?? {};
  expect(
    JSON.stringify(Object.keys(exportsMap).sort()) ===
      JSON.stringify(Object.keys(published).sort()),
    "publishes different subpaths than it exports in the workspace",
  );
  for (const [subpath, target] of Object.entries(exportsMap)) {
    if (subpath === "./package.json" || (typeof target === "string" && target.endsWith(".json")))
      continue;
    expect(
      typeof target === "string" && /^\.\/src\/.+\.tsx?$/.test(target),
      `exports ${subpath} from somewhere other than src`,
    );
    const out = published[subpath] as { types?: string; default?: string } | undefined;
    expect(
      out?.types?.startsWith("./dist/") &&
        out.types.endsWith(".d.ts") &&
        out.default?.startsWith("./dist/") &&
        out.default.endsWith(".js"),
      `publishes ${subpath} without dist types and code`,
    );
  }

  expect(manifest.scripts?.build === "tsdown", "does not build with tsdown");
  expect(manifest.scripts?.["check-types"], "has no check-types script");
  expect(manifest.scripts?.test?.startsWith("vitest run"), "does not test with vitest run");

  const tsconfig = pkg.read("tsconfig.json");
  expect(
    tsconfig && JSON.parse(tsconfig).extends === "../../tsconfig.base.json",
    "does not extend tsconfig.base.json",
  );
  const tsdown = pkg.read("tsdown.config.ts") ?? "";
  expect(/unbundle: true/.test(tsdown), "does not build with unbundle");
  expect(/dts: true/.test(tsdown), "does not emit declarations");
  expect(/fixedExtension: false/.test(tsdown), "does not emit .js and .d.ts");
  expect(pkg.read("README.md"), "has no README.md");
  expect(
    pkg.list("test").some((file) => file.endsWith(".test.ts")),
    "has no tests",
  );
  return problems;
}

function onDisk(directory: string, path: string): PackageFiles {
  return {
    directory,
    read: (file) =>
      existsSync(join(path, file)) ? readFileSync(join(path, file), "utf8") : undefined,
    list: (dir) =>
      existsSync(join(path, dir))
        ? readdirSync(join(path, dir), { recursive: true }).map(String)
        : [],
  };
}

describe("package template", () => {
  it.each(packages().map((pkg) => [pkg.manifest.name as string, pkg] as const))(
    "%s follows it",
    (_, pkg) => {
      expect(checkPackage(onDisk(pkg.directory, pkg.path))).toEqual([]);
    },
  );

  it("is what `pnpm new:package` creates", () => {
    const files = packageTemplate({ directory: "example", description: "An example." });
    const pkg: PackageFiles = {
      directory: "example",
      read: (path) => files[path],
      list: (dir) => Object.keys(files).filter((path) => path.startsWith(`${dir}/`)),
    };
    expect(checkPackage(pkg)).toEqual([]);
  });

  it("catches a package that breaks it", () => {
    const pkg: PackageFiles = {
      directory: "broken",
      read: (path) =>
        path === "package.json"
          ? JSON.stringify({ name: "x", exports: { ".": "./dist/index.js" } })
          : undefined,
      list: () => [],
    };
    expect(checkPackage(pkg).length).toBeGreaterThan(5);
  });

  it("turns on isolatedDeclarations and erasable syntax for every package", () => {
    const base = readFileSync(join(root, "tsconfig.base.json"), "utf8");
    expect(base).toMatch(/"isolatedDeclarations": true/);
    expect(base).toMatch(/"erasableSyntaxOnly": true/);
  });
});
