// A stub run's build, once per run, in a directory of the run's own: a test may start a run while
// another is going. The run's scratch goes with it.
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { buildStubDocument } from "./build.ts";
import { runDirectory, stubBuild } from "./playwright.config.ts";

export default async function globalSetup(): Promise<() => void> {
  await buildStubDocument(fileURLToPath(new URL(".", import.meta.url)), stubBuild);
  return () => rmSync(runDirectory, { recursive: true, force: true });
}
