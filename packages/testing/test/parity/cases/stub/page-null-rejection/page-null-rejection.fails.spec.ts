// `Promise.reject()` has no reason to report: it goes to the console, so L13 judges it.
import { expect, it } from "vitest";

import "../../../../../src/setup.ts";
import { describeTargets } from "../../../../../src/index.ts";
import "../../../dom-target.ts";

describeTargets("stub/page-null-rejection", () => {
  it("rejects with no reason", async () => {
    void Promise.reject();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(1).toBe(1);
  });

  it("logs an error event that holds only a message", () => {
    window.dispatchEvent(new ErrorEvent("error", { message: "uf-probe-observer" }));
    expect(1).toBe(1);
  });
});
