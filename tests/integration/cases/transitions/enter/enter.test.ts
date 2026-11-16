// transitions/enter: `<Transition>` with the default name, `v` (ADR-0100). Once the details
// enter, they carry `v-enter-from` and `v-enter-active` before they are first painted, then
// `v-enter-to` without `v-enter-from` from the next frame on, then no class of the transition once
// the enter ends. The harness gives no transition a duration (plan §7.6), so the second test gives
// the case's `-active` classes one for itself, and reads the classes once a frame: every capture
// still sees the settled DOM.
import { describeTargets, it, mountScenario } from "@unframework.dev/testing";
import { expect } from "vitest";

import Panel from "./Panel.uf.tsx";

/**
 * Reads, once a frame until `stop`, the transition's classes of each element `selector` matches
 * in `root`, as `text: classes`, and returns each reading that differs from the one before.
 */
function everyFrame(root: Element, selector: string, prefix: string): { stop: () => string[] } {
  const frames: string[] = [];
  let running = true;
  const read = () => {
    if (!running) return;
    const elements = [...root.querySelectorAll(selector)];
    frames.push(
      elements
        .map((element) => {
          const classes = [...element.classList].filter((name) => name.startsWith(`${prefix}-`));
          return `${element.textContent}: ${classes.toSorted().join(" ")}`.trimEnd();
        })
        .toSorted()
        .join(" | "),
    );
    requestAnimationFrame(read);
  };
  requestAnimationFrame(read);
  return {
    stop: () => {
      running = false;
      return frames.filter((frame, index) => frame !== frames[index - 1]);
    },
  };
}

/** Gives the `-active` classes of `name` a duration of their own, until the returned removal. */
function slowDown(name: string): () => void {
  const style = document.createElement("style");
  // A class beats the harness's `*` among `!important` declarations.
  style.textContent = `.${name}-enter-active, .${name}-leave-active { transition: all 200ms linear !important; }`;
  document.head.append(style);
  return () => style.remove();
}

describeTargets("transitions/enter", () => {
  it("renders the closed panel", async () => {
    const view = await mountScenario(Panel, "closed");
    await view.expectParity("closed");
    await expect.element(view.getByRole("button", { name: "Details" })).toBeVisible();
  });

  it(
    "runs the enter classes in order, then none",
    { requires: ["transition", "interactivity"] },
    async () => {
      const restore = slowDown("v");
      try {
        const view = await mountScenario(Panel, "closed");
        const frames = everyFrame(view.container, ".details", "v");
        await view.user.click(view.getByRole("button", { name: "Details" }));
        await view.expectParity("opened");
        expect(frames.stop()).toEqual([
          "",
          "Ships in two days.: v-enter-active v-enter-from",
          "Ships in two days.: v-enter-active v-enter-to",
          "Ships in two days.:",
        ]);
        await expect.element(view.getByText("Ships in two days.")).toBeVisible();
      } finally {
        restore();
      }
    },
  );
});
