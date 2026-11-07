// A scenario whose committed artefacts match: every parity layer passes and is recorded, and the
// View's queries, html() and argument checks behave.
import { expect, it } from "vitest";

import "../../../../../src/setup.ts";
import { expectLayerFailure } from "../../../../../src/browser/behaviour.ts";
import { currentTarget, describeTargets, mount } from "../../../../../src/index.ts";
import { NO_INTERACTION_SKIP } from "../../../../../src/layers.ts";
import { normalizeHtml } from "../../../../../src/normalize/index.ts";
import { LIVE_REFERENCE_SKIP } from "../../../../../src/visual-types.ts";
import "../../../dom-target.ts";
import { itUnlessUpdate, sibling } from "../../../stub-api.ts";

const greeting = { html: '<p class="greeting">Hello, world!</p>' };

describeTargets("stub/match", () => {
  it("names the suite after the target", ({ task }) => {
    expect(currentTarget()).toBe("dom");
    expect(task.suite?.name).toBe("stub/match [dom]");
  });

  const recorded =
    "passes L7 and L11, skips L9 and the live reference's L10, and records each of them";

  it(recorded, async ({ task }) => {
    const view = await mount(greeting);
    await expect.element(view.getByText("Hello, world!")).toBeVisible();
    await view.expectParity("initial");
    expect(task.meta.uf).toEqual({
      case: "stub/match",
      target: "dom",
      layers: {
        L7: { status: "pass" },
        // No action or rerender led to the scenario: there is no trace to compare.
        L9: { status: "skip", reason: NO_INTERACTION_SKIP },
        // "dom" is the reference and pixels are live: its capture is what the others would be
        // compared with, so nothing was compared, and a pass would claim otherwise.
        L10: { status: "skip", reason: LIVE_REFERENCE_SKIP },
        L11: { status: "pass" },
      },
      scenarios: ["initial"],
    });
  });

  it("had recorded L13 by the time that test ended", () => {
    expect(sibling(recorded)?.meta.uf?.layers.L13).toEqual({ status: "pass" });
  });

  itUnlessUpdate(
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

  let left: HTMLElement | undefined;

  it("mounts a view a test may leave mounted", async () => {
    const view = await mount(greeting);
    left = view.container;
    expect(left.isConnected).toBe(true);
  });

  it("unmounted what that test left mounted", () => {
    expect(left?.isConnected).toBe(false);
  });
});
