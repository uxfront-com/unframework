// A scenario whose committed artefacts match: every parity layer passes and is recorded, and the
// View's queries, html() and argument checks behave.
import { expect, inject, it, onTestFinished } from "vitest";

import "../../../../../src/setup.ts";
import { expectLayerFailure } from "../../../../../src/browser/behaviour.ts";
import { currentTarget, describeTargets, mount } from "../../../../../src/index.ts";
import { normalizeHtml } from "../../../../../src/normalize/index.ts";
import { LIVE_REFERENCE_SKIP } from "../../../../../src/visual-types.ts";
import "../../../dom-target.ts";

const greeting = { html: '<p class="greeting">Hello, world!</p>' };
const update = inject("ufHarness").update;

describeTargets("stub/match", () => {
  it("names the suite after the target", ({ task }) => {
    expect(currentTarget()).toBe("dom");
    expect(task.suite?.name).toBe("stub/match [dom]");
  });

  it("passes L7 and L11, skips the live reference's L10, and records each of them", async ({
    task,
  }) => {
    onTestFinished(() => {
      // The setup's afterEach has recorded L13 by now.
      expect(task.meta.uf?.layers.L13).toEqual({ status: "pass" });
    });
    const view = await mount(greeting);
    await expect.element(view.getByText("Hello, world!")).toBeVisible();
    await view.expectParity("initial");
    expect(task.meta.uf).toEqual({
      case: "stub/match",
      target: "dom",
      layers: {
        L7: { status: "pass" },
        // "dom" is the reference and pixels are live: its capture is what the others would be
        // compared with, so nothing was compared, and a pass would claim otherwise.
        L10: { status: "skip", reason: LIVE_REFERENCE_SKIP },
        L11: { status: "pass" },
      },
      scenarios: ["initial"],
    });
  });

  // Update mode would write the artefacts these tests expect to be missing.
  it.skipIf(update)(
    "fails a scenario without artefacts, naming the command that writes them",
    async ({ task }) => {
      const view = await mount(greeting);
      // It resolves: the shared layers are recorded, and the test goes on to its own assertions.
      await view.expectParity("absent");
      const l7 = expectLayerFailure(
        "L7",
        /Missing artefact cases\/stub\/match\/__expected__\/dom\.absent\.html\. Run `pnpm test:update` to write it/,
      );
      expect(l7).toContain("Missing artefact cases/stub/match/__expected__/aria.absent.yaml");
      // L10 is live here, and "dom" is the reference: its capture is the expectation.
      expect(task.meta.uf?.layers.L10).toEqual({ status: "skip", reason: LIVE_REFERENCE_SKIP });
      expect(task.meta.uf?.layers.L11).toEqual({ status: "pass" });
      expect(task.meta.uf?.scenarios).toEqual(["absent"]);
    },
  );

  it.skipIf(update).fails(
    "fails the test, after its own assertions, with a layer that failed",
    async ({ task }) => {
      const view = await mount(greeting);
      await view.expectParity("absent");
      expect(task.meta.uf?.layers.L7?.status).toBe("fail");
      await expect.element(view.getByText("Hello, world!")).toBeVisible();
    },
  );

  it.skipIf(update)("recorded the failed layer and the passing behaviour above", ({ task }) => {
    const sibling = task.suite?.tasks.find(
      (test) => test.name === "fails the test, after its own assertions, with a layer that failed",
    );
    expect(sibling?.meta.uf?.layers).toMatchObject({
      L7: { status: "fail", message: expect.stringMatching(/Missing artefact/) },
      L8: { status: "pass" },
    });
  });

  it("serialises the container as normalised HTML", async () => {
    const view = await mount(greeting);
    expect(view.html()).toBe(normalizeHtml(greeting.html));
  });

  it("scopes queries to the view's container", async () => {
    const first = await mount({ html: "<button>Save</button>" });
    const second = await mount({ html: "<button>Save</button><button>Cancel</button>" });
    expect(first.getByRole("button").elements()).toHaveLength(1);
    expect(second.getByRole("button").elements()).toHaveLength(2);
    // No harness landmark: the page a component is rendered into owns the landmarks.
    expect(first.container.parentElement).toBe(document.body);
    expect(first.locator.selector).toContain("uf-root-");
  });

  it("refuses scenario names that are not kebab-case and tolerances without a reason", async () => {
    const view = await mount(greeting);
    for (const name of ["Initial", "after--click", "open-"]) {
      await expect(view.expectParity(name)).rejects.toThrow(/kebab-case/);
    }
    await expect(
      view.expectParity("initial", { tolerance: { maxDiffPixels: 10, reason: " " } }),
    ).rejects.toThrow(/needs a reason/);
  });

  it("removes the container when the adapter fails to mount", async () => {
    const before = document.querySelectorAll("[data-uf-root]").length;
    await expect(mount({ html: "", fail: "adapter exploded" })).rejects.toThrow("adapter exploded");
    expect(document.querySelectorAll("[data-uf-root]")).toHaveLength(before);
  });

  it("unmounts what a test leaves mounted", async () => {
    const view = await mount(greeting);
    expect(view.container.isConnected).toBe(true);
    onTestFinished(() => {
      expect(view.container.isConnected).toBe(false);
    });
  });
});
