// Test helpers: compile Astro source with Astro's compiler and load it as a module, without a
// Vite server. The module is written next to the package so `astro/compiler-runtime` resolves.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { transform } from "@astrojs/compiler-rs";

/** A scratch directory under the package's gitignored `.uf-tmp/`, unique to this worker. */
export function scratchDirectory(name: string): { path: string; remove(): void } {
  const path = join(import.meta.dirname, "..", ".uf-tmp", `${name}-${process.pid}`);
  mkdirSync(path, { recursive: true });
  return { path, remove: () => rmSync(path, { recursive: true, force: true }) };
}

let modules = 0;

/** Compiles an `.astro` source and imports it; resolves to the component (default export). */
export async function loadAstroComponent(directory: string, source: string): Promise<unknown> {
  const name = `Component${++modules}`;
  const { code, diagnostics } = transform(source, {
    filename: join(directory, `${name}.astro`),
    normalizedFilename: `/${name}.astro`,
    compact: "jsx",
    internalURL: "astro/compiler-runtime",
    resultScopedSlot: true,
    scopedStyleStrategy: "attribute",
    // Without it the output imports `createMetadata`, which the runtime does not export.
    resolvePath: (specifier) => specifier,
  });
  if (diagnostics.length > 0) throw new Error(JSON.stringify(diagnostics));
  const file = join(directory, `${name}.mjs`);
  writeFileSync(file, code);
  const module: { default: unknown } = await import(file);
  return module.default;
}
