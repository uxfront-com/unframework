import { runSummary } from "./summary.ts";
// `pnpm test` and `pnpm test:update`: one Vitest run of every project, then the parity summary,
// whatever the run's result, so a red run still leaves its matrix. Arguments after the script
// name go to Vitest (`pnpm test -- --project compile`).
//
// `--update` sets UF_UPDATE=1 (ADR-0029): the compile project writes the goldens and the
// reference target the shared expectations. It is refused in CI, which never writes.
import { isCI, runVitest } from "./vitest.ts";

const update = process.argv.includes("--update");
const args = process.argv.slice(2).filter((arg) => arg !== "--update" && arg !== "--");

if (update && isCI(process.env)) {
  console.error("[uf] CI never writes artefacts: refusing `pnpm test:update` while CI is set.");
  process.exit(1);
}
if (update && process.env.UF_CANARY) {
  console.error(
    "[uf] A canary run never writes artefacts: unset UF_CANARY for `pnpm test:update`.",
  );
  process.exit(1);
}

const env = { ...process.env, ...(update ? { UF_UPDATE: "1" } : {}) };
const started = new Date();
const { status } = runVitest(args, env);
// The summary judges what this run selected; only CI's parity job requires every project.
const summary = runSummary(env, { since: started, requireComplete: false });
process.exitCode = status || summary;
