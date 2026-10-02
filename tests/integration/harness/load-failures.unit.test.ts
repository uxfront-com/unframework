// The load-failure reporter, on modules shaped like Vitest's: a spec whose import failed is
// recorded with Vitest's error and the cause under it (the golden guard's message); a module
// that loaded is not.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { LoadFailureReporter, readLoadFailures } from "./load-failures.ts";

const root = mkdtempSync(join(tmpdir(), "uf-load-failures-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

const module = (project: string, file: string, errors: unknown[]) => ({
  project: { name: project },
  moduleId: join(root, file),
  errors: () => errors as { message?: string; cause?: unknown }[],
});

describe("LoadFailureReporter", () => {
  it("records each module that failed to load, with every cause, sorted", () => {
    const file = join(root, "canary", "load-failures.json");
    expect(readLoadFailures(file)).toBeUndefined();
    new LoadFailureReporter({ file, root }).onTestRunEnd([
      module("browser:vue", "cases/a/b/b.test.ts", [
        {
          message: "Failed to import test file",
          cause: { message: "[uf guard] The vue output of …", cause: { message: "deeper" } },
        },
      ]),
      module("browser:react", "cases/a/b/b.test.ts", [{ message: "Failed to import test file" }]),
      module("browser:react", "cases/a/c/c.test.ts", []),
    ]);
    expect(readLoadFailures(file)).toEqual([
      {
        project: "browser:react",
        file: "cases/a/b/b.test.ts",
        errors: ["Failed to import test file"],
      },
      {
        project: "browser:vue",
        file: "cases/a/b/b.test.ts",
        errors: [
          "Failed to import test file\ncaused by: [uf guard] The vue output of …\ncaused by: deeper",
        ],
      },
    ]);
  });

  it("writes an empty list when every module loaded", () => {
    const file = join(root, "clean.json");
    new LoadFailureReporter({ file, root }).onTestRunEnd([
      module("ssr:vue", "harness/ssr.test.ts", []),
    ]);
    expect(readLoadFailures(file)).toEqual([]);
  });
});
