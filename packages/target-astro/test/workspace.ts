// Where the repository keeps what the toolchain checks: the corpus and the Astro toolchain.
import { globSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { ToolchainFile } from "@unframework/codegen";

const repo = join(import.meta.dirname, "..", "..", "..");

/** The integration project: the root the harness runs Astro output from. */
export const integrationRoot: string = join(repo, "tests", "integration");

/** The Astro toolchain directory: `@astrojs/check` on TypeScript 6, and its tsconfig. */
export const toolchainDir: string = join(repo, "tests", "toolchains", "astro");

/**
 * M5's types and generics cases (ADR-0067, ADR-0068), which Astro emits from its types lane, layer
 * 28 of M5 (UXF-467): until then `harness/quarantine/astro.ts` lists their failing cells, and the lane
 * brings them back here.
 */
const TYPES_LANE = /(?:^|\/)(?:types|generics|diagnostics\/generic-slot-props)\//;

/** Every committed golden Astro output in the corpus, but the cases of its types lane. */
export function goldenAstroFiles(): ToolchainFile[] {
  return globSync("cases/**/__output__/astro/*.astro", { cwd: integrationRoot })
    .filter((file) => !TYPES_LANE.test(file))
    .toSorted()
    .map((file) => {
      const path = join(integrationRoot, file);
      return { path, contents: readFileSync(path, "utf8") };
    });
}
