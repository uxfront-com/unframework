// `pnpm test:baselines`' pass for the cases that name their own reference target (ADR-0057),
// run inside the baseline container after browser:vue's: each such target's browser project, on
// its cases alone (UF_REFERENCE_PASS), with the caller's arguments (`referencePasses`). A caller
// whose filters select none of those cases passes, and Vitest says so. It exits with the first
// failing pass's status.
import { spawnSync } from "node:child_process";

import { listCases } from "../harness/cases.ts";
import { referencePasses } from "../harness/references.ts";

let status = 0;
for (const { target, args } of referencePasses(listCases(), process.argv.slice(2))) {
  const run = spawnSync(
    process.execPath,
    ["scripts/run.ts", "--project", `browser:${target}`, "--passWithNoTests", ...args],
    { stdio: "inherit", env: { ...process.env, UF_REFERENCE_PASS: "1" } },
  );
  if (run.status !== 0 && status === 0) status = run.status ?? 1;
}
process.exitCode = status;
