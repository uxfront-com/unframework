// transitions/swap: a ternary swap and an else-if chain, each in a `<Transition>` and each of one
// tag (ADR-0100). When the shown branch changes, the old element leaves while the new one enters,
// so both are in the DOM, the old one with `-leave-active` and the new one with `-enter-active`,
// until the leave ends, and then only the new one stays. Their order in the DOM during the swap is
// the target's, so each frame's reading sorts them. The harness gives no transition a duration
// (plan §7.6), so the tests that swap give the case's `-active` classes one for themselves, and
// read the classes once a frame.
import { describeTargets, it, mountScenario } from "@unframework.dev/testing";
import { expect } from "vitest";

import Steps from "./Steps.uf.tsx";

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
describeTargets("transitions/swap", () => {
  it("renders the first branch of each", async () => {
    const view = await mountScenario(Steps, "default");
    await view.expectParity("default");
    await expect.element(view.getByText("Cart")).toBeVisible();
    await expect.element(view.getByText("Step one")).toBeVisible();
  });

  it(
    "runs the old branch's leave and the new one's enter at once",
    { requires: ["transition", "interactivity"] },
    async () => {
      const restore = slowDown("swap");
      try {
        const view = await mountScenario(Steps, "default");
        const frames = everyFrame(view.container, ".card", "swap");
        await view.user.click(view.getByRole("button", { name: "Swap" }));
        await view.expectParity("swapped");
        expect(frames.stop()).toEqual([
          "Cart:",
          "Cart: swap-leave-active swap-leave-from | Payment: swap-enter-active swap-enter-from",
          "Cart: swap-leave-active swap-leave-to | Payment: swap-enter-active swap-enter-to",
          "Payment:",
        ]);
        await expect.element(view.getByText("Payment")).toBeVisible();
        expect(view.container.querySelectorAll(".card")).toHaveLength(1);
      } finally {
        restore();
      }
    },
  );

  it(
    "runs each step of an else-if chain in turn",
    { requires: ["transition", "interactivity"] },
    async () => {
      const restore = slowDown("step");
      try {
        const view = await mountScenario(Steps, "default");
        const frames = everyFrame(view.container, ".step", "step");
        await view.user.click(view.getByRole("button", { name: "Next" }));
        await view.expectParity("second-step");
        await view.user.click(view.getByRole("button", { name: "Next" }));
        await view.expectParity("third-step");
        expect(frames.stop()).toEqual([
          "Step one:",
          "Step one: step-leave-active step-leave-from | Step two: step-enter-active step-enter-from",
          "Step one: step-leave-active step-leave-to | Step two: step-enter-active step-enter-to",
          "Step two:",
          "Step three: step-enter-active step-enter-from | Step two: step-leave-active step-leave-from",
          "Step three: step-enter-active step-enter-to | Step two: step-leave-active step-leave-to",
          "Step three:",
        ]);
        await expect.element(view.getByText("Step three")).toBeVisible();
      } finally {
        restore();
      }
    },
  );
});
