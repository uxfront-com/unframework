// Styleframe in the harness (ADR-0064): the corpus's configuration builds for production with no
// licence key, a configuration flagged as Pro does not, CI sets no key, and the checkers'
// declarations are those Styleframe writes for the configuration.
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, inject, it } from "vitest";

import { REPO_ROOT, ROOT } from "./paths.ts";
import {
  sourceUtilities,
  STYLEFRAME_CONFIG,
  STYLEFRAME_DECLARATIONS,
  styleframeDeclarations,
} from "./styleframe.ts";

/** A production build of a configuration, as CI would run one: no licence key in any form. */
function productionBuild(config: string): { status: number | null; output: string } {
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "production" };
  // Styleframe reads `STYLEFRAME_KEY`, and the same name behind a framework's public prefix
  // (`VITE_STYLEFRAME_KEY`, `NUXT_STYLEFRAME_KEY`…).
  for (const name of Object.keys(env)) if (name.endsWith("STYLEFRAME_KEY")) delete env[name];
  const result = spawnSync(
    process.execPath,
    [join(ROOT, "scripts", "styleframe-build.ts"), "build", config],
    { cwd: ROOT, env, encoding: "utf8" },
  );
  return { status: result.status, output: result.stdout + result.stderr };
}

describe("the Styleframe licence", () => {
  it("builds the corpus's configuration for production with no licence key", () => {
    const { status, output } = productionBuild(STYLEFRAME_CONFIG);
    expect(status, output).toBe(0);
  });

  it("fails a configuration flagged as Pro without a licence key", () => {
    const { status, output } = productionBuild(join(ROOT, "harness", "styleframe-pro.config.ts"));
    expect(status).not.toBe(0);
    expect(output).toContain(
      "A valid styleframe Pro license key is required to build in production mode.",
    );
  });

  it("is never set in CI", () => {
    const workflows = join(REPO_ROOT, ".github", "workflows");
    for (const file of readdirSync(workflows)) {
      expect(readFileSync(join(workflows, file), "utf8"), file).not.toContain("STYLEFRAME_KEY");
    }
  });
});

describe("the declarations of Styleframe's virtual modules", () => {
  it("are those Styleframe writes for the corpus's configuration", async () => {
    const expected = await styleframeDeclarations();
    if (inject("ufHarness").update) writeFileSync(STYLEFRAME_DECLARATIONS, expected);
    expect(
      readFileSync(STYLEFRAME_DECLARATIONS, "utf8"),
      "tests/integration/styleframe.d.ts differs from the configuration's: run `pnpm test:update`.",
    ).toBe(expected);
  });
});

describe("sourceUtilities", () => {
  it("reads the utility classes of a source's static `class`", () => {
    const source = '<p class="note _padding:md _border-radius:[4px]">x</p>';
    expect(sourceUtilities(source, "/cases/a/b/Note.uf.tsx")).toEqual([
      "_padding:md",
      "_border-radius:[4px]",
    ]);
  });

  it("reads no other file", () => {
    expect(sourceUtilities('<p class="_padding:md" />', "/cases/a/b/note.test.ts")).toEqual([]);
  });
});
