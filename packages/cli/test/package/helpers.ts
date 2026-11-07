import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach } from "vitest";

import { project } from "../helpers.ts";

const REPOSITORY = fileURLToPath(new URL("../../../../", import.meta.url));

/** A package in this repository, by its path from the root. */
export const inRepository = (path: string): string => join(REPOSITORY, path);

const SOURCES = {
  "src/Card.uf.tsx": `import { CardTitle } from "./CardTitle.uf.tsx";
import { formatLabel } from "./shared/format";

import "./Card.css";

export default function Card(props: { label: string }) {
  return (
    <div class="card">
      <CardTitle label={formatLabel(props.label)} />
    </div>
  );
}
`,
  "src/CardTitle.uf.tsx": `export function CardTitle(props: { label: string }) {
  return <h2>{props.label}</h2>;
}
`,
  "src/Card.css": ".card {\n  color: red;\n}\n",
  "src/shared/format.ts": "export const formatLabel = (label: string): string => label.trim();\n",
  "src/useToggle.uf.ts": `import { ref } from "unframework";

export function useToggle(initial: boolean) {
  const on = ref(initial);
  return { on };
}
`,
};

export const SOURCE_TREE: readonly string[] = [
  "source/Card.css",
  "source/Card.uf.tsx",
  "source/CardTitle.uf.tsx",
  "source/shared/format.ts",
  "source/useToggle.uf.ts",
];

export interface DesignSystem {
  /** `unframework.config.ts`'s fields, as JSON. */
  config: Record<string, unknown>;
  /** Packages `node_modules` links to, each by its path in `tests/integration/node_modules`. */
  frameworks?: readonly string[];
  /** Files beside or over the sources. */
  files?: Readonly<Record<string, string>>;
  /** Replaces the project's `package.json`, or leaves it out with `null`. */
  manifest?: string | null;
}

/** A project that compiles a small design system, as a team would lay it out. */
export function designSystem(options: DesignSystem): string {
  const { config, frameworks = [], files = {}, manifest } = options;
  const owned: Record<string, string> =
    manifest === null
      ? {}
      : {
          "package.json":
            manifest ??
            JSON.stringify({ name: "demo-ds", version: "1.2.3", license: "MIT", private: true }),
        };
  const root = project({
    ...SOURCES,
    ...owned,
    "unframework.config.ts": `export default ${JSON.stringify(config)};\n`,
    ...files,
  });
  for (const name of frameworks) {
    const link = join(root, "node_modules", name);
    mkdirSync(dirname(link), { recursive: true });
    symlinkSync(inRepository(`tests/integration/node_modules/${name}`), link);
  }
  return root;
}

const consumers: string[] = [];

afterEach(() => {
  for (const directory of consumers.splice(0)) rmSync(directory, { recursive: true, force: true });
});

/**
 * An app that has installed `<root>/dist/package` as `demo-ds`, with its files and a tsconfig that
 * extends `tests/toolchains/<target>`'s, which names where the framework resolves. It sits in that
 * toolchain's `.uf-tmp`, as the toolchain's own temporary configs do.
 */
export function consumer(
  root: string,
  target: string,
  files: Readonly<Record<string, string>>,
): string {
  const parent = join(inRepository(`tests/toolchains/${target}`), ".uf-tmp");
  mkdirSync(parent, { recursive: true });
  const directory = mkdtempSync(join(parent, "consumer-"));
  consumers.push(directory);
  mkdirSync(join(directory, "node_modules"));
  symlinkSync(join(root, "dist", "package"), join(directory, "node_modules", "demo-ds"));
  writeFileSync(
    join(directory, "tsconfig.json"),
    JSON.stringify({ extends: "../../tsconfig.json", include: Object.keys(files) }),
  );
  for (const [path, contents] of Object.entries(files)) {
    writeFileSync(join(directory, path), contents);
  }
  return directory;
}

/** Runs a checker from its package's `node_modules/.bin`, and gives its exit code and output. */
export function check(
  from: string,
  bin: string,
  args: readonly string[],
): { code: number | null; output: string } {
  const result = spawnSync(join(inRepository(from), "node_modules", ".bin", bin), [...args], {
    cwd: inRepository(from),
    encoding: "utf8",
  });
  return { code: result.status, output: `${result.stdout}${result.stderr}` };
}
