// transitions/outer: a `<Transition>` inside a condition of its own (ADR-0100). Only a change of
// the transition's own child runs a leave: when the outer condition turns false, or the component
// unmounts, the child goes at once, as on Vue, and never carries `fade-leave-active`. The tests
// give the case's `-active` classes a duration of their own, so a leave that ran would show, and
// watch the child's classes from before the step: a settle waits for a leave to end, so only
// what the child carried on the way tells the two apart.
import { describeTargets, it, mountScenario } from "@unframework.dev/testing";
import { expect } from "vitest";

import Drawer from "./Drawer.uf.tsx";

/** Records every class the element carries from now on, until `stop`. */
function watchClasses(element: Element): { stop: () => string[] } {
  const seen = new Set(element.classList);
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const name of record.oldValue?.split(/\s+/) ?? []) if (name) seen.add(name);
    }
    for (const name of element.classList) seen.add(name);
  });
  observer.observe(element, {
    attributes: true,
    attributeFilter: ["class"],
    attributeOldValue: true,
  });
  return {
    stop: () => {
      for (const record of observer.takeRecords()) {
        for (const name of record.oldValue?.split(/\s+/) ?? []) if (name) seen.add(name);
      }
      for (const name of element.classList) seen.add(name);
      observer.disconnect();
      return [...seen].toSorted();
    },
  };
}

/** Gives the `-active` classes of `fade` a duration of their own, until the returned removal. */
function slowDown(): () => void {
  const style = document.createElement("style");
  // A class beats the harness's `*` among `!important` declarations.
  style.textContent =
    ".fade-enter-active, .fade-leave-active { transition: all 200ms linear !important; }";
  document.head.append(style);
  return () => style.remove();
}

describeTargets("transitions/outer", () => {
  it("renders the drawer's body", async () => {
    const view = await mountScenario(Drawer, "default");
    await view.expectParity("default");
    await expect.element(view.getByText("Colour, size")).toBeVisible();
  });

  it(
    "removes the child at once when the outer condition turns false",
    { requires: ["transition", "interactivity"] },
    async () => {
      const restore = slowDown();
      try {
        const view = await mountScenario(Drawer, "default");
        const body = view.container.querySelector(".body")!;
        const classes = watchClasses(body);
        await view.user.click(view.getByRole("button", { name: "Drawer" }));
        await view.expectParity("hidden");
        expect(body.isConnected).toBe(false);
        expect(classes.stop()).toEqual(["body"]);
        await expect.element(view.getByRole("button", { name: "Body" })).toBeVisible();
      } finally {
        restore();
      }
    },
  );

  it(
    "removes the child at once when the component unmounts",
    { requires: ["transition", "interactivity"] },
    async () => {
      const restore = slowDown();
      try {
        const view = await mountScenario(Drawer, "default");
        await view.expectParity("mounted");
        await expect.element(view.getByText("Colour, size")).toBeVisible();
        const body = view.container.querySelector(".body")!;
        const classes = watchClasses(body);
        await view.unmount();
        expect(body.isConnected).toBe(false);
        expect(classes.stop()).toEqual(["body"]);
      } finally {
        restore();
      }
    },
  );
});
