// The page host's runner and clock, through the setup's judge: each test here that fails does so
// on purpose, and `test/page-host.test.ts` reads each test's record.
import { describe, expect, inject } from "vitest";

import "../../../../../src/setup.ts";
import { advanceClock } from "../../../../../src/browser/clock.ts";
import { host } from "../../../../../src/browser/host.ts";
import { describeTargets, it, mount } from "../../../../../src/index.ts";
import type { StubComponent } from "../../../dom-target.ts";
import "../../../dom-target.ts";

const hello: StubComponent = { html: "<p>Hello</p>" };

/** A component with an interval, which counts its ticks in its text. */
const ticking: StubComponent = {
  html: '<p data-testid="count">0</p>',
  setup(container, _emit, signal) {
    let count = 0;
    const id = setInterval(() => {
      count += 1;
      container.querySelector("p")!.textContent = String(count);
    }, 100);
    signal.addEventListener("abort", () => clearInterval(id));
  },
};

describeTargets("stub/page-host", () => {
  it("passes a test that asserted", async () => {
    const view = await mount(hello);
    await expect.element(view.getByText("Hello")).toBeVisible();
  });

  it("gives a test its task", ({ task }) => {
    const { name, suite } = task as unknown as { name: string; suite: { name: string } };
    expect(name).toBe("gives a test its task");
    expect(task.file.filepath).toContain("runner.page.spec.ts");
    expect(suite.name).toBe("stub/page-host [dom]");
  });

  it("fails a test that asserted nothing", () => {});

  it("fails a test whose assertion fails, recording it as L8", async () => {
    const view = await mount(hello);
    await expect.element(view.getByText("Hello"), { timeout: 50 }).toHaveTextContent("Goodbye");
  });

  it("fails a test whose locator finds nothing", async () => {
    const view = await mount(hello);
    await expect.element(view.getByRole("button", { name: "Nope" }), { timeout: 50 }).toBeVisible();
  });

  it("fails a test that left an assertion unawaited", async () => {
    const view = await mount(hello);
    void expect.element(view.getByText("Hello")).toBeVisible();
    expect(1).toBe(1);
  });

  it("fails a test that ran out of time", { timeout: 50 }, async () => {
    expect(1).toBe(1);
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  it("records a console message as L13", () => {
    console.warn("uf-probe-warning");
    expect(1).toBe(1);
  });

  it("bounds expect.element by the poll timeout", async () => {
    const start = Date.now();
    await expect
      .element(host().page.getByTestId("nothing"))
      .toBeVisible()
      .catch(() => {});
    const waited = Date.now() - start;
    expect(waited).toBeGreaterThanOrEqual(190);
    expect(waited).toBeLessThan(2_000);
  });

  it("records a thrown value that isn't an error as L8", () => {
    expect(1).toBe(1);
    // oxlint-disable-next-line no-throw-literal -- what it checks
    throw "uf-probe-string";
  });

  it("records each error of an AggregateError as L8", () => {
    expect(1).toBe(1);
    throw new AggregateError([new Error("uf-probe-one"), new Error("uf-probe-two")]);
  });

  it("fails a test that held the page past its time", { timeout: 20 }, () => {
    expect(1).toBe(1);
    const end = Date.now() + 80;
    while (Date.now() < end);
  });

  it("names what a command it doesn't have", async () => {
    const failure = await host()
      .commands.ufAstroRender({} as never)
      .catch((error: unknown) => error);
    expect((failure as Error).message).toBe("The driver has no command named ufAstroRender.");
  });

  it("gives the runtime expect.stringMatching", () => {
    expect("abc").toEqual(expect.stringMatching(/b/));
  });

  it("gives a spec on the alias its inject", () => {
    expect(inject("target")).toBe("dom");
  });

  describe("a nested suite", () => {
    it("names the test by every suite", () => {
      expect(1).toBe(1);
    });
  });

  it("keeps a failed visual comparison's images for the reporter", async ({ task }) => {
    await host().recordVisualFailure(task, { message: "uf-probe-visual", attachments: [] });
    expect(1).toBe(1);
  });

  it("cuts a long page out of an element error at Vitest's limit", async () => {
    await mount({ html: `<p>${"x".repeat(8_000)}</p>` } satisfies StubComponent);
    const failure = await expect
      .element(host().page.getByTestId("nothing"), { timeout: 50 })
      .toBeVisible()
      .catch((error: unknown) => error);
    const { name, message } = failure as Error;
    expect(name).toBe("VitestBrowserElementError");
    expect(message).toContain("\n\nHTML:\n");
    expect(message.endsWith("...")).toBe(true);
  });

  it("moves the clock only through tick", async () => {
    const view = await mount(ticking, { clock: true });
    const count = view.getByTestId("count");
    await new Promise((resolve) => setTimeout(resolve, 250));
    await expect.element(count).toHaveTextContent("0");
    // A failing assertion tries again: Vitest's poll would advance its fake timers on each try.
    await expect
      .element(count, { timeout: 250 })
      .toHaveTextContent("9")
      .catch(() => {});
    await expect.element(count).toHaveTextContent("0");
    await view.clock.tick(100);
    await expect.element(count).toHaveTextContent("1");
    await view.clock.tick(250);
    await expect.element(count).toHaveTextContent("3");
  });

  it("fakes only the intervals, and gives them back", async () => {
    const native = { setInterval, clearInterval, setTimeout, clearTimeout, date: Date };
    const running = setInterval(() => {}, 1_000);
    host().clock.install();
    expect(setInterval).not.toBe(native.setInterval);
    expect(clearInterval).not.toBe(native.clearInterval);
    expect(setTimeout).toBe(native.setTimeout);
    expect(clearTimeout).toBe(native.clearTimeout);
    expect(Date).toBe(native.date);
    // Started before the clock and cleared while it runs: no warning, or L13 would fail this.
    clearInterval(running);
    let fired = 0;
    setInterval(() => {
      fired += 1;
    }, 10);
    await advanceClock(35, async (fire) => {
      await fire();
    });
    expect(fired).toBe(3);
    host().clock.restore();
    expect(setInterval).toBe(native.setInterval);
    expect(clearInterval).toBe(native.clearInterval);
  });

  it("runs a test whose required capability is supported", { requires: ["interactivity"] }, () => {
    expect(1).toBe(1);
  });
});
