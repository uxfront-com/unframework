// L11 against a case that declares the axe rules it breaks (case.json: ["image-alt"]).
import { expect, inject, it } from "vitest";
import type { RunnerTestCase } from "vitest";

import "../../../../../src/setup.ts";
import { expectLayerFailure } from "../../../../../src/browser/behaviour.ts";
import { describeTargets, mount } from "../../../../../src/index.ts";
import "../../../dom-target.ts";

const PIXEL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Crect width='8' height='8' fill='%23345'/%3E%3C/svg%3E";
const update = inject("ufHarness").update;

/**
 * Runs a scenario and returns its L11 failure, if any. The other layers are not the subject:
 * the scenario has no committed artefacts, so its L7 failure is consumed.
 */
async function l11Failure(
  task: RunnerTestCase,
  html: string,
  scenario: string,
): Promise<string | undefined> {
  const view = await mount({ html });
  await view.expectParity(scenario);
  expectLayerFailure("L7", /Missing artefact/);
  if (task.meta.uf?.layers.L11?.status !== "fail") return undefined;
  return `L11: ${expectLayerFailure("L11", /./)}`;
}

describeTargets("stub/axe", () => {
  it("passes when axe reports exactly the declared rules", async ({ task }) => {
    const view = await mount({ html: `<img src="${PIXEL}" width="8" height="8">` });
    await view.expectParity("initial");
    expect(task.meta.uf?.layers.L11).toEqual({ status: "pass" });
  });

  // Update mode would write artefacts for these scenarios, which must stay absent.
  it.skipIf(update)("fails on a rule the case did not declare", async ({ task }) => {
    const failure = await l11Failure(
      task,
      `<img src="${PIXEL}" width="8" height="8"><div role="uf-invalid">x</div>`,
      "undeclared",
    );
    expect(failure).toMatch(/^L11: axe-core violations differ from case\.json's "axe" list:/);
    expect(failure).toMatch(/aria-roles \(critical\): .* at div\[role="uf-invalid"\]/);
    expect(failure).not.toMatch(/image-alt/);
  });

  it.skipIf(update)(
    "lets a component render its own landmarks, a <main> among them",
    async ({ task }) => {
      // The mount root sits in <body>, outside any harness landmark: the component's <main> is the
      // page's only one, at the top level, so only the declared image-alt is reported.
      const failure = await l11Failure(
        task,
        `<header>Site</header><main><h1>Page</h1><img src="${PIXEL}" width="8" height="8"></main>`,
        "landmarks",
      );
      expect(failure).toBeUndefined();
    },
  );

  it.skipIf(update)("still reports a landmark nested where it may not be", async ({ task }) => {
    const failure = await l11Failure(
      task,
      `<img src="${PIXEL}" width="8" height="8"><main><main>Nested</main></main>`,
      "nested-main",
    );
    expect(failure).toMatch(/landmark-main-is-top-level|landmark-no-duplicate-main/);
  });

  it.skipIf(update)("fails when a declared rule is not reported", async ({ task }) => {
    const failure = await l11Failure(
      task,
      `<img src="${PIXEL}" width="8" height="8" alt="A square">`,
      "clean",
    );
    expect(failure).toContain("declared in case.json but not reported: image-alt");
  });
});
