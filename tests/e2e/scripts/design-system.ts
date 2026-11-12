// Runs the design system's tests and its visual suite in the copy `prepare-apps` installed outside
// the repository, from the packed tarballs (ADR-0089). Both always run, so a failed test still
// leaves the visual report, and the script fails when either does.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { copyMarker, designSystemCopyName, workDir } from "../harness/apps.ts";

const copy = join(workDir(), designSystemCopyName);
if (!existsSync(join(copy, copyMarker))) {
  throw new Error(
    `${copy} has no design system: run \`pnpm --filter @unframework.dev/e2e prepare-apps\` first.`,
  );
}

const run = (command: string): number => {
  process.stdout.write(`[e2e] ${designSystemCopyName}: unframework ${command}\n`);
  const { status, error } = spawnSync("pnpm", ["exec", "unframework", command], {
    cwd: copy,
    stdio: "inherit",
  });
  if (error) throw error;
  return status ?? 1;
};

const codes = [run("test"), run("visual")];
process.stdout.write(`[e2e] ${designSystemCopyName}: ${join(copy, ".unframework/visual")}\n`);
process.exitCode = Math.max(...codes);
