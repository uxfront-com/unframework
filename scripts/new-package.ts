// Creates a package from the template every Unframework package follows (plan §5.2):
// exports point at src in the workspace and at dist when published, tsdown builds it with
// `unbundle`, isolatedDeclarations is on, and Vitest runs the tests.
//
//   pnpm new:package <directory> "<description>"
//   pnpm new:package type-oracle "The TypeOracle interface and the syntactic resolver."
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export interface PackageTemplateOptions {
  /** The directory under packages/, e.g. `type-oracle`. */
  directory: string;
  /** The npm name; defaults to `@unframework/<directory>`. */
  name?: string;
  description: string;
}

/** The files of a new package, by path relative to the package directory. */
export function packageTemplate(options: PackageTemplateOptions): Record<string, string> {
  const name = options.name ?? `@unframework/${options.directory}`;
  const manifest = {
    name,
    version: "0.0.0",
    private: true,
    description: options.description,
    keywords: ["unframework"],
    homepage: `https://github.com/uxfront-com/unframework/tree/main/packages/${options.directory}#readme`,
    bugs: "https://github.com/uxfront-com/unframework/issues",
    license: "MIT",
    repository: {
      type: "git",
      url: "git+https://github.com/uxfront-com/unframework.git",
      directory: `packages/${options.directory}`,
    },
    files: ["dist"],
    type: "module",
    sideEffects: false,
    exports: { ".": "./src/index.ts", "./package.json": "./package.json" },
    publishConfig: {
      exports: {
        ".": { types: "./dist/index.d.ts", default: "./dist/index.js" },
        "./package.json": "./package.json",
      },
      access: "public",
    },
    scripts: { build: "tsdown", "check-types": "tsc --noEmit", test: "vitest run" },
    devDependencies: {
      "@types/node": "catalog:",
      "@uxfront/typescript-config": "catalog:",
      tsdown: "catalog:",
      vitest: "catalog:",
    },
  };
  return {
    "package.json": `${JSON.stringify(manifest, null, 2)}\n`,
    "tsconfig.json": `${JSON.stringify(
      {
        extends: "../../tsconfig.base.json",
        compilerOptions: { types: ["node"] },
        include: ["src", "test", "tsdown.config.ts"],
      },
      null,
      2,
    )}\n`,
    "tsdown.config.ts": [
      'import { defineConfig } from "tsdown";',
      'import type { UserConfig } from "tsdown";',
      "",
      "const config: UserConfig = defineConfig({",
      '  entry: ["src/index.ts"],',
      "  unbundle: true,",
      '  platform: "node",',
      "  dts: true,",
      "  // `.js` and `.d.ts`, which publishConfig.exports name.",
      "  fixedExtension: false,",
      "});",
      "",
      "export default config;",
      "",
    ].join("\n"),
    "src/index.ts": "export {};\n",
    "test/index.test.ts": [
      'import { expect, it } from "vitest";',
      'import * as entry from "../src/index.ts";',
      "",
      'it("loads", () => {',
      '  expect(entry).toBeTypeOf("object");',
      "});",
      "",
    ].join("\n"),
    "README.md": `# ${name}\n\n${options.description}\n`,
  };
}

if (import.meta.main) {
  const [directory, description] = process.argv.slice(2);
  if (!directory || !description) {
    console.error('Usage: pnpm new:package <directory> "<description>"');
    process.exit(1);
  }
  const root = join(fileURLToPath(new URL("..", import.meta.url)), "packages", directory);
  if (existsSync(root)) {
    console.error(`packages/${directory} already exists.`);
    process.exit(1);
  }
  for (const [path, contents] of Object.entries(packageTemplate({ directory, description }))) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), contents);
  }
  console.log(`Created packages/${directory}. Run \`pnpm install\` to link it.`);
}
