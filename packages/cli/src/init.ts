// `unframework init` (plan §8.3, ADR-0076, ADR-0073). The files are strings here, so they ship in
// `dist` with no copy step. No test file until `@unframework/testing` is public (M7).
import { lstatSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import type { Stats } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";

import type { RunCommand } from "./command.ts";

const CONFIG = `import { defineConfig } from "unframework/config";

export default defineConfig({
  targets: ["react", "vue", "svelte", "solid", "angular", "qwik", "astro"],
  srcDir: "src",
  outDir: "dist",
});
`;

const BUTTON = `import "./Button.css";

export default function Button({ label }: { label: string }) {
  return (
    <button class="button" type="button">
      {label}
    </button>
  );
}
`;

const BUTTON_CSS = `.button {
  padding: 8px 16px;
  border: 0;
  border-radius: 6px;
  background-color: rgb(30, 64, 175);
  color: rgb(255, 255, 255);
  font: inherit;
  cursor: pointer;
}
`;

const TSCONFIG = `${JSON.stringify(
  {
    compilerOptions: {
      module: "esnext",
      moduleResolution: "bundler",
      strict: true,
      noEmit: true,
      allowImportingTsExtensions: true,
      jsx: "preserve",
      jsxImportSource: "unframework",
    },
    include: ["**/*.uf.tsx", "**/*.uf.ts"],
    exclude: ["dist"],
  },
  null,
  2,
)}
`;

const AGENTS = `# Agent guide

This project writes its components as \`.uf.tsx\` files, and Unframework compiles each one to native
React, Vue, Svelte, Solid, Angular, Qwik and Astro. A component's source isn't any one framework's
code, so read https://unframework.dev/docs before you change one.

- \`unframework check\` reports diagnostics and writes no file. Add \`--format json\` to parse them.
- \`unframework explain <code>\` prints what a diagnostic means, with a link to its documentation.
- \`tsc --noEmit -p tsconfig.uf.json\` type-checks the sources, once the project has \`typescript\`.
- \`unframework build\` writes each target to \`dist/<target>\`. It cleans that directory first, so
  change the source and build again instead of editing an output.
`;

const FILES: readonly (readonly [path: string, contents: string])[] = [
  ["unframework.config.ts", CONFIG],
  ["src/Button.uf.tsx", BUTTON],
  ["src/Button.css", BUTTON_CSS],
  ["tsconfig.uf.json", TSCONFIG],
  ["AGENTS.md", AGENTS],
];

// `loadConfig` takes the `.ts` file first, so writing one beside these would silently replace a
// project's config. `--force` is how a project asks for that.
const OTHER_CONFIGS = ["unframework.config.mts", "unframework.config.js", "unframework.config.mjs"];

export const run: RunCommand = async (args, io) => {
  const { values } = parseArgs({ args, options: { force: { type: "boolean", default: false } } });
  const root = io.cwd;
  // `lstat`, so a dangling symlink counts as a file in the way.
  const found = (path: string): Stats | undefined =>
    lstatSync(join(root, path), { throwIfNoEntry: false });

  // Everything that can refuse comes before the first write, so a refusal writes nothing. `--force`
  // treats each kind of file differently, so the message says what it would do with each.
  const paths = FILES.map(([path]) => path);
  const directories = paths.filter((path) => found(path)?.isDirectory());
  const files = paths.filter((path) => found(path) && !directories.includes(path));
  const configs = OTHER_CONFIGS.filter((path) => found(path));
  const taken = [...directories, ...files, ...configs].toSorted();
  const noDirectory = `--force can't replace a directory, so remove ${directories.join(", ")} first.`;
  const kept = `${configs.join(", ")}, but unframework.config.ts takes precedence.`;
  if (taken.length > 0 && !values.force) {
    const lines = [`In the way: ${taken.join(", ")}.`];
    if (files.length > 0) lines.push(`--force overwrites ${files.join(", ")}.`);
    if (configs.length > 0) lines.push(`--force keeps ${kept}`);
    if (directories.length > 0) lines.push(noDirectory);
    throw new Error(lines.join(" "));
  }
  if (directories.length > 0) throw new Error(noDirectory);
  for (const path of new Set(paths.map(dirname))) {
    mkdirSync(join(root, path), { recursive: true });
  }

  for (const [path, contents] of FILES) {
    // A file's own symlink is replaced, so this can't overwrite what it points at. A symlinked `src`
    // is followed, as `check` and `build` follow it.
    rmSync(join(root, path), { force: true });
    writeFileSync(join(root, path), contents);
    io.stdout(`Wrote ${path}\n`);
  }
  if (configs.length > 0) io.stderr(`Kept ${kept}\n`);
  return 0;
};
