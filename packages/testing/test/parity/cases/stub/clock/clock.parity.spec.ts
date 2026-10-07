// `view.clock` end to end on the stub target (ADR-0050): a view mounted with `{ clock: true }`
// runs on a fake `setInterval`, installed before the component mounts, so its interval fires
// only when the spec ticks, and the tick's step holds what it emitted; a tick runs the intervals
// due one at a time and settles after each, so a render in a frame of its own comes between
// them; after the unmount a tick records no step; `Date` and `setTimeout` stay real; and the
// page has its real intervals back when the test ends.
import { expect, vi } from "vitest";

import "../../../../../src/setup.ts";
import { describeTargets, it, mount } from "../../../../../src/index.ts";
import type { StubComponent } from "../../../dom-target.ts";
import "../../../dom-target.ts";

/**
 * A ticker: its button starts an interval, every `every` milliseconds (a prop, 20 by default),
 * that counts in the status and emits each count. The unmount clears it, unless it `leaks`.
 */
function ticker(leaks = false): StubComponent {
  return {
    html: ({ every = 20 }) =>
      `<p role="status" data-every="${String(every)}">0</p><button type="button">Start</button>`,
    emits: [{ name: "tick", optional: [false] }],
    setup(container, emit, signal) {
      const status = container.querySelector("p")!;
      let timer: ReturnType<typeof setInterval> | undefined;
      container.querySelector("button")!.addEventListener(
        "click",
        () => {
          timer = setInterval(() => {
            const next = Number(status.textContent) + 1;
            status.textContent = String(next);
            emit("tick", next);
          }, Number(status.dataset.every));
        },
        { signal },
      );
      if (!leaks) signal.addEventListener("abort", () => clearInterval(timer));
    },
  };
}

/**
 * A countdown that renders in a frame of its own, as a framework whose render is a scheduled
 * task does: each second an interval counts down, and the next frame shows the count and emits
 * it beside the count it showed before, as a watcher of it would.
 */
function framedCountdown(): StubComponent {
  return {
    html: '<p role="status">3</p><button type="button">Start</button>',
    emits: [{ name: "changed", optional: [false, false] }],
    setup(container, emit, signal) {
      const status = container.querySelector("p")!;
      let left = 3;
      let shown = 3;
      let frame = 0;
      let timer: ReturnType<typeof setInterval> | undefined;
      const render = () => {
        frame = 0;
        if (left === shown) return;
        emit("changed", left, shown);
        shown = left;
        status.textContent = String(left);
      };
      container.querySelector("button")!.addEventListener(
        "click",
        () => {
          timer = setInterval(() => {
            left -= 1;
            if (left === 0) clearInterval(timer);
            frame ||= requestAnimationFrame(render);
          }, 1000);
        },
        { signal },
      );
      signal.addEventListener("abort", () => {
        clearInterval(timer);
        cancelAnimationFrame(frame);
      });
    },
  };
}

describeTargets("stub/clock", () => {
  it(
    "runs the intervals due one at a time, settling after each, as real time would",
    { requires: ["interactivity"] },
    async () => {
      const view = await mount(framedCountdown(), { clock: true });
      await view.user.click(view.getByRole("button", { name: "Start" }));
      // Two seconds and a half: the intervals at 1000 and 2000 ms, each rendered before the next
      // runs. Run back to back, they would count twice before one frame rendered, and the frame
      // would show 1 after 3.
      await view.clock.tick(2500);
      await view.expectParity("counted-down");
      await expect.element(view.getByRole("status")).toHaveTextContent("1");
      expect(view.emitted("changed")).toEqual([
        [2, 3],
        [1, 2],
      ]);
      // The last interval was due at 3000 ms, after the first tick's end: this one runs it.
      await view.clock.tick(500);
      await view.expectParity("finished");
      await expect.element(view.getByRole("status")).toHaveTextContent("0");
      expect(view.emitted("changed")).toEqual([
        [2, 3],
        [1, 2],
        [0, 1],
      ]);
    },
  );

  it(
    "runs an interval only when the clock ticks, inside the tick's step",
    { requires: ["interactivity"] },
    async () => {
      const view = await mount(ticker(), { clock: true });
      await view.user.click(view.getByRole("button", { name: "Start" }));
      // A fixed wait, only to prove that real time runs no interval: five of them.
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(view.emitted("tick")).toEqual([]);
      // Two intervals and a half: the ticks at 20 and 40 ms, both in this step.
      await view.clock.tick(50);
      await view.expectParity("ticked");
      await expect.element(view.getByRole("status")).toHaveTextContent("2");
      expect(view.emitted("tick")).toEqual([[1], [2]]);
      await view.unmount();
      const start = Date.now();
      await view.clock.tick(60_000);
      // The unmount cleared the interval, and the clock faked `Date` no more than `setTimeout`.
      expect(view.emitted("tick")).toEqual([[1], [2]]);
      expect(Date.now() - start).toBeLessThan(60_000);
    },
  );

  it(
    "shows what an interval left running emits after the unmount, with no step",
    { requires: ["interactivity"] },
    async () => {
      const view = await mount(ticker(true), { clock: true });
      await view.user.click(view.getByRole("button", { name: "Start" }));
      await view.expectParity("leak-started");
      await expect.element(view.getByRole("status")).toHaveTextContent("0");
      await view.unmount();
      // No step: one would be left uncompared, and fail L9 when the test ends.
      await view.clock.tick(50);
      expect(view.emitted("tick")).toEqual([[1], [2]]);
    },
  );

  it("gives the page its real intervals back when the test ends", async () => {
    expect(vi.isFakeTimers()).toBe(false);
    await new Promise<void>((resolve) => {
      const timer = setInterval(() => {
        clearInterval(timer);
        resolve();
      }, 5);
    });
  });

  it(
    "refuses a tick without a clock, a tick that is not whole milliseconds, and a second clock",
    { requires: ["interactivity"] },
    async () => {
      const plain = await mount(ticker());
      await expect(plain.clock.tick(100)).rejects.toThrow(
        "view.clock.tick: this view was mounted without a clock. Mount it with { clock: true }",
      );
      const view = await mount(ticker(), { clock: true });
      await expect(view.clock.tick(0)).rejects.toThrow(
        "view.clock.tick: the time to advance is a positive whole number of milliseconds, not 0.",
      );
      await expect(view.clock.tick(1.5)).rejects.toThrow(/milliseconds, not 1\.5\.$/);
      await expect(mount(ticker(), { clock: true })).rejects.toThrow(
        "mount: a view of this test has a clock already.",
      );
      // Two views, and the second clock refused before it mounted anything.
      expect(document.querySelectorAll("[data-uf-root]")).toHaveLength(2);
    },
  );
});
