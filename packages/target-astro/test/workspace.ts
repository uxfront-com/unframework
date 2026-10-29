// Where the repository keeps what the toolchain checks: the corpus and the Astro toolchain.
import { globSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { ToolchainFile } from "@unframework/codegen";

const repo = join(import.meta.dirname, "..", "..", "..");

/** The integration project: the root the harness runs Astro output from. */
export const integrationRoot: string = join(repo, "tests", "integration");

/** The Astro toolchain directory: `@astrojs/check` on TypeScript 6, and its tsconfig. */
export const toolchainDir: string = join(repo, "tests", "toolchains", "astro");

/** Every committed golden Astro output in the corpus. */
export function goldenAstroFiles(): ToolchainFile[] {
  return globSync("cases/**/__output__/astro/*.astro", { cwd: integrationRoot })
    .toSorted()
    .map((file) => {
      const path = join(integrationRoot, file);
      return { path, contents: readFileSync(path, "utf8") };
    });
}
