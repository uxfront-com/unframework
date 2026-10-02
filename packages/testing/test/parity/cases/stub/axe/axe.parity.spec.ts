// L11 against a case that declares the axe rules it breaks (case.json: ["image-alt"]).
import { expect, inject, it } from "vitest";

import "../../../../../src/setup.ts";
import { describeTargets, LayerFailure, mount } from "../../../../../src/index.ts";
import "../../../dom-target.ts";

const PIXEL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Crect width='8' height='8' fill='%23345'/%3E%3C/svg%3E";
const update = inject("ufHarness").update;

/** Runs a scenario and returns its L11 failure, if any; the other layers are not the subject. */
async function l11Failure(html: string, scenario: string): Promise<string | undefined> {
  const view = await mount({ html });
  const error = await view.expectParity(scenario).then(
    () => undefined,
    (caught: unknown) => caught,
  );
  if (error === undefined) return undefined;
  if (!(error instanceof LayerFailure)) throw error;
  return error.failures.find((failure) => failure.startsWith("L11: "));
}

describeTargets("stub/axe", () => {
  it("passes when axe reports exactly the declared rules", async ({ task }) => {
    const view = await mount({ html: `<img src="${PIXEL}" width="8" height="8">` });
    await view.expectParity("initial");
    expect(task.meta.uf?.layers.L11).toEqual({ status: "pass" });
  });

  // Update mode would write artefacts for these scenarios, which must stay absent.
  it.skipIf(update)("fails on a rule the case did not declare", async () => {
    const failure = await l11Failure(
      `<img src="${PIXEL}" width="8" height="8"><div role="uf-invalid">x</div>`,
      "undeclared",
    );
    expect(failure).toMatch(/^L11: axe-core violations differ from case\.json's "axe" list:/);
    expect(failure).toMatch(/aria-roles \(critical\): .* at div\[role="uf-invalid"\]/);
    expect(failure).not.toMatch(/image-alt/);
  });

  it.skipIf(update)("lets a component render its own landmarks, a <main> among them", async () => {
    // The mount root sits in <body>, outside any harness landmark: the component's <main> is the
    // page's only one, at the top level, so only the declared image-alt is reported.
    const failure = await l11Failure(
      `<header>Site</header><main><h1>Page</h1><img src="${PIXEL}" width="8" height="8"></main>`,
      "landmarks",
    );
    expect(failure).toBeUndefined();
  });

  it.skipIf(update)("still reports a landmark nested where it may not be", async () => {
    const failure = await l11Failure(
      `<img src="${PIXEL}" width="8" height="8"><main><main>Nested</main></main>`,
      "nested-main",
    );
    expect(failure).toMatch(/landmark-main-is-top-level|landmark-no-duplicate-main/);
  });

  it.skipIf(update)("fails when a declared rule is not reported", async () => {
    const failure = await l11Failure(
      `<img src="${PIXEL}" width="8" height="8" alt="A square">`,
      "clean",
    );
    expect(failure).toContain("declared in case.json but not reported: image-alt");
  });
});
