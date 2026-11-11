// The nightly's WebKit batches (ADR-0081), read from nightly.yml: Vitest keeps every project's
// browser alive until its run ends, so WebKit runs the browser projects in several runs. Each
// must compare its followers with the reference's capture from the same run (ADR-0066), and
// together they must run every target once.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { REPO_ROOT } from "./paths.ts";
import { REFERENCE, selectTargets } from "./targets.ts";

const WORKFLOW = readFileSync(join(REPO_ROOT, ".github", "workflows", "nightly.yml"), "utf8");

/** Each engine's batches, from the browser job's matrix: none means one run of every target. */
function batchesOf(engine: string): string[][] | undefined {
  const entry = new RegExp(`^ {10}- browser: ${engine}\\n {12}batches: "([^"]*)"$`, "m").exec(
    WORKFLOW,
  );
  return entry?.[1]!.split(" ").map((batch) => batch.split(","));
}

describe("the nightly's browser job", () => {
  const targets: readonly string[] = selectTargets(undefined);

  it("runs WebKit in batches that each hold the reference, and every follower once", () => {
    const batches = batchesOf("webkit");
    if (!batches) throw new Error("nightly.yml gives WebKit no batches.");
    expect(batches.length).toBeGreaterThan(1);
    for (const batch of batches) {
      expect(batch[0]).toBe(REFERENCE);
      expect(batch.every((target) => targets.includes(target))).toBe(true);
    }
    const followers = batches.flatMap((batch) => batch.slice(1));
    expect(followers.toSorted()).toEqual(
      targets.filter((target) => target !== REFERENCE).toSorted(),
    );
  });

  it("runs Firefox in one run of every target", () => {
    expect(batchesOf("firefox")).toBeUndefined();
    expect(WORKFLOW).toContain("browser: [firefox, webkit]");
  });

  it("runs every batch, then the browser-only summary, and fails if any of them failed", () => {
    expect(WORKFLOW).toMatch(
      /for targets in \$BATCHES; do\n.*\n.*UF_TARGETS="\$targets".*\|\| status=1/,
    );
    expect(WORKFLOW).toContain(
      "pnpm --filter @unframework.dev/integration summary -- --browser-only || status=1",
    );
    expect(WORKFLOW).toContain('exit "$status"');
  });
});
