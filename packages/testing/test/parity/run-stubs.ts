// A run of some stub specs, for a test that reads its verdict: Playwright's own process, since a
// Vitest test can't hold `@playwright/test`, with what its reporter wrote read back.
import { execFile } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import type { ReportedSpec } from "../../src/driver/reporter.ts";
import type { PageTestRecord } from "../../src/hosts/page/protocol.ts";
import type { PartialMatrix } from "../../src/node/matrix.ts";
import { packageRoot } from "./project.ts";

/** What a run left. */
export interface StubRun {
  status: number;
  output: string;
  specs: ReportedSpec[];
  /** Every test's record, by its name: a stub file's names are its own. */
  tests: Map<string, PageTestRecord>;
  matrix: PartialMatrix;
}

const CLI = join(
  dirname(createRequire(import.meta.url).resolve("@playwright/test/package.json")),
  "cli.js",
);

/** Runs specs by their globs under `cases/stub`. */
export async function runStubs(
  specs: readonly string[],
  options: { complete?: boolean } = {},
): Promise<StubRun> {
  const reports = mkdtempSync(join(tmpdir(), "uf-stub-"));
  try {
    const { status, output } = await new Promise<{ status: number; output: string }>((resolve) => {
      execFile(
        process.execPath,
        [CLI, "test", "--config", "test/parity/playwright.config.ts"],
        {
          cwd: packageRoot,
          maxBuffer: 64 * 1024 * 1024,
          env: {
            ...process.env,
            UF_STUB_SPECS: specs.join(","),
            UF_STUB_REPORTS: reports,
            ...(options.complete ? { UF_STUB_COMPLETE: "1" } : {}),
          },
        },
        (error, stdout, stderr) => {
          const code = (error as { code?: unknown } | null)?.code;
          resolve({
            status: error ? (typeof code === "number" ? code : 1) : 0,
            output: `${stdout}\n${stderr}`,
          });
        },
      );
    });
    const matrixFile = readdirSync(reports).find((name) => name.startsWith("parity-matrix."));
    if (!matrixFile) throw new Error(`The stub run wrote no matrix:\n${output}`);
    const reported = JSON.parse(
      readFileSync(join(reports, "records.json"), "utf8"),
    ) as ReportedSpec[];
    return {
      status,
      output,
      specs: reported,
      tests: new Map(reported.flatMap(({ tests }) => tests.map((test) => [test.name, test]))),
      matrix: JSON.parse(readFileSync(join(reports, matrixFile), "utf8")) as PartialMatrix,
    };
  } finally {
    rmSync(reports, { recursive: true, force: true });
  }
}
