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

  it("runs no enter as it first mounts", async () => {
    const restore = slowDown();
    // Watched from before the mount: the first render's child enters only with `appear`.
    const seen = new Set<string>();
    const record = (element: Element) => {
      if (!element.classList.contains("body")) return;
      for (const name of element.classList) seen.add(name);
    };
    const observer = new MutationObserver((records) => {
      for (const each of records) {
        if (each.target instanceof Element) record(each.target);
        for (const name of each.oldValue?.split(/\s+/) ?? [])
          if (name.startsWith("fade-")) seen.add(name);
        for (const node of each.addedNodes) {
          if (node instanceof Element) [node, ...node.querySelectorAll(".body")].forEach(record);
        }
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class"],
      attributeOldValue: true,
    });
    try {
      const view = await mountScenario(Drawer, "default");
      await view.expectParity("first-mount");
      await expect.element(view.getByText("Colour, size")).toBeVisible();
      for (const each of observer.takeRecords()) {
        if (each.target instanceof Element) record(each.target);
      }
      expect([...seen].filter((name) => name.startsWith("fade-"))).toEqual([]);
    } finally {
      observer.disconnect();
      restore();
    }
  });

  it(
    "runs no enter when the outer condition shows it again",
    { requires: ["transition", "interactivity"] },
    async () => {
      const restore = slowDown();
      try {
        const view = await mountScenario(Drawer, "default");
        await view.user.click(view.getByRole("button", { name: "Drawer" }));
        await view.expectParity("drawer-hidden");
        await expect.element(view.getByRole("button", { name: "Drawer" })).toBeVisible();
        const seen = new Set<string>();
        const observer = new MutationObserver((records) => {
          for (const each of records) {
            for (const name of each.oldValue?.split(/\s+/) ?? []) if (name) seen.add(name);
            const targets = [each.target, ...each.addedNodes];
            for (const node of targets) {
              if (!(node instanceof Element)) continue;
              for (const element of [node, ...node.querySelectorAll(".body")]) {
                if (element.classList.contains("body")) {
                  for (const name of element.classList) seen.add(name);
                }
              }
            }
          }
        });
        observer.observe(view.container, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ["class"],
          attributeOldValue: true,
        });
        try {
          await view.user.click(view.getByRole("button", { name: "Drawer" }));
          await view.expectParity("drawer-shown");
          observer.takeRecords();
        } finally {
          observer.disconnect();
        }
        await expect.element(view.getByText("Colour, size")).toBeVisible();
        expect([...seen].toSorted()).toEqual(["body"]);
      } finally {
        restore();
      }
    },
  );

  it(
    "runs the leave when its own condition turns false",
    { requires: ["transition", "interactivity"] },
    async () => {
      const restore = slowDown();
      try {
        const view = await mountScenario(Drawer, "default");
        const body = view.container.querySelector(".body")!;
        const classes = watchClasses(body);
        await view.user.click(view.getByRole("button", { name: "Body" }));
        await view.expectParity("body-hidden");
        // The positive control of the tests above: the same element, with the same duration,
        // runs its leave when the transition's own child changes.
        expect(classes.stop()).toEqual([
          "body",
          "fade-leave-active",
          "fade-leave-from",
          "fade-leave-to",
        ]);
        expect(body.isConnected).toBe(false);
        await expect.element(view.getByRole("button", { name: "Drawer" })).toBeVisible();
      } finally {
        restore();
      }
    },
  );

  it(
    "runs no enter when its own condition changed while the outer one hid it",
    { requires: ["transition", "interactivity"] },
    async () => {
      const restore = slowDown();
      try {
        const view = await mountScenario(Drawer, "default");
        await view.user.click(view.getByRole("button", { name: "Drawer" }));
        await view.user.click(view.getByRole("button", { name: "Body" }));
        await view.user.click(view.getByRole("button", { name: "Body" }));
        await view.expectParity("toggled-while-hidden");
        await expect.element(view.getByRole("button", { name: "Drawer" })).toBeVisible();
        const seen = new Set<string>();
        const observer = new MutationObserver((records) => {
          for (const each of records) {
            for (const name of each.oldValue?.split(/\s+/) ?? []) if (name) seen.add(name);
            for (const node of [each.target, ...each.addedNodes]) {
              if (!(node instanceof Element)) continue;
              for (const element of [node, ...node.querySelectorAll(".body")]) {
                if (element.classList.contains("body")) {
                  for (const name of element.classList) seen.add(name);
                }
              }
            }
          }
        });
        observer.observe(view.container, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ["class"],
          attributeOldValue: true,
        });
        try {
          await view.user.click(view.getByRole("button", { name: "Drawer" }));
          await view.expectParity("shown-after-toggles");
          observer.takeRecords();
        } finally {
          observer.disconnect();
        }
        await expect.element(view.getByText("Colour, size")).toBeVisible();
        expect([...seen].toSorted()).toEqual(["body"]);
      } finally {
        restore();
      }
    },
  );
});
