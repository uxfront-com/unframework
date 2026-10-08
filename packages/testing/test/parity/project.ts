// The browser project that runs the testing API's own parity tests against the stub "dom"
// target. Its cases live in `test/parity/cases/<area>/<name>/` like the corpus's, each spec next
// to its committed `__expected__` artefacts.
//
// `UF_UPDATE=1` regenerates the artefacts of the cases that verify passing layers, with the same
// refusals as the harness (never in CI, never with Vitest's -u). "dom" is its own reference and
// has no Linux baselines, so L10 is always live: its capture is the expectation, and the visual
// command's comparisons are unit-tested in Node (test/visual-command.test.ts).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { CAPABILITY_NAMES } from "@unframework/codegen";
import type { Capabilities, CapabilityCell } from "@unframework/codegen";
import type { TestProjectInlineConfiguration } from "vitest/config";

import type { CaseConfig, HarnessContext } from "../../src/harness.ts";
import { createHarnessRun, parityBrowser, resolveHarnessMode } from "../../src/node/index.ts";

const here = fileURLToPath(new URL(".", import.meta.url));
const casesDir = join(here, "cases");
/** The testing package, the parity project's root. */
export const packageRoot: string = join(here, "..", "..");
const scratch = join(packageRoot, ".uf-tmp", "parity");

/** Every case directory under `cases/<area>/<name>`, with its case.json. */
function fixtureCases(): Record<string, CaseConfig> {
  const cases: Record<string, CaseConfig> = {};
  for (const area of readdirSync(casesDir)) {
    for (const name of readdirSync(join(casesDir, area))) {
      const file = join(casesDir, area, name, "case.json");
      cases[`${area}/${name}`] = existsSync(file)
        ? (JSON.parse(readFileSync(file, "utf8")) as CaseConfig)
        : {};
    }
  }
  return cases;
}

/** The harness context of the fixture run. */
export function fixtureHarness(
  env: Readonly<Record<string, string | undefined>>,
  argv: readonly string[] = process.argv,
): HarnessContext {
  return createHarnessRun({
    root: scratch,
    casesDir,
    reference: "dom",
    mode: resolveHarnessMode({ env, platform: process.platform, argv, liveOnly: true }),
    quarantine: [
      // The quarantine case: L7 fails (no artefacts) and is recorded as quarantined, not failed.
      { case: "stub/quarantine", target: "dom", layer: "L7", reason: "fixture", issue: "#L7" },
      // L11 passes: one test cannot tell a stale entry from one another test of the cell still
      // needs, so the pass is recorded as it is (the run's reporter decides, per cell).
      { case: "stub/quarantine", target: "dom", layer: "L11", reason: "fixture", issue: "#L11" },
      // A warning after the last test, recorded on the file as quarantined (late-console.test.ts).
      {
        case: "stub/late-console-known",
        target: "dom",
        layer: "L13",
        reason: "fixture",
        issue: "#late",
      },
      // A failing assertion, recorded as quarantined: the test passes unless another layer fails.
      { case: "stub/behaviour-known", target: "dom", layer: "L8", reason: "fixture", issue: "#L8" },
      // An entry whose case passes L8: the run's reporter fails it as stale (behaviour.test.ts).
      {
        case: "stub/behaviour-stale",
        target: "dom",
        layer: "L8",
        reason: "fixture",
        issue: "#stale",
      },
    ],
    cases: fixtureCases(),
  });
}

/** The reason the stub gives for the one capability it lacks. */
export const STUB_LISTBOX_REASON = "the stub target renders no list box";

/**
 * The stub target's capability matrix: every capability, but a list box, which a test that
 * requires it is skipped for (`stub/requires`).
 */
export const STUB_CAPABILITIES: Capabilities = Object.fromEntries(
  CAPABILITY_NAMES.map((name): [string, CapabilityCell] => [
    name,
    name === "listbox"
      ? { support: "unsupported", code: "UF4001", severity: "info", reason: STUB_LISTBOX_REASON }
      : { support: "native" },
  ]),
) as Capabilities;

/**
 * The `parity` project: the stub target in Chromium, with the harness's browser and commands,
 * and the corpus's rule that every test asserts something (`requireAssertions`, ADR-0043). It
 * runs the `*.parity.spec.ts` specs; `include` picks others, such as the `*.late.spec.ts` ones
 * that fail on purpose.
 */
export function parityProject(
  env: Readonly<Record<string, string | undefined>> = process.env,
  include: readonly string[] = ["test/parity/cases/**/*.parity.spec.ts"],
): TestProjectInlineConfiguration {
  return {
    extends: false,
    test: {
      name: "parity",
      root: packageRoot,
      include: [...include],
      provide: {
        target: "dom",
        ufHarness: fixtureHarness(env),
        ufCapabilities: STUB_CAPABILITIES,
      },
      // The harness's: the setup bounds `expect.element` by the poll timeout, and requires one.
      expect: { requireAssertions: true, poll: { timeout: 5_000 } },
      browser: parityBrowser({ name: "parity" }),
    },
  };
}
