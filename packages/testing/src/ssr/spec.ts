// The server render spec of a project's tests (`defineTestConfig`, ADR-0086): its `ssr:<target>`
// projects include this file by its resolved path, and provide the cases it renders.
import { inject } from "vitest";

import { describeServerRender } from "./index.ts";

const cases = inject("ufSsrCases");
if (cases === undefined) {
  throw new Error(
    `[uf] The ssr:${inject("target")} project provides no "ufSsrCases": this spec runs only in an ssr project of defineTestConfig.`,
  );
}
describeServerRender(cases);
