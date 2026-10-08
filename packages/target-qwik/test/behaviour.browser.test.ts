// What the corpus relies on Qwik's output to do (the semantics contract, ADR-0045 to ADR-0048), run in
// Chromium: small sources (./behaviour/*.uf.tsx), compiled by this target (./sources.ts) and the
// optimizer, mounted by the toolchain's adapter, acted on as the testing API acts (each action
// through `interact`, then settled), with the emitted events recorded through the adapter's
// listeners. No retrying assertion: each action has settled when the test reads the page.
import type { MountedComponent } from "@unframework/codegen";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { mount } from "../src/toolchain/client.ts";

/** A behaviour source, as this target emits it (a computed path: not this tsconfig's). */
const load = async (name: string): Promise<unknown> =>
  ((await import(`./behaviour/${name}.uf.tsx`)) as { default: unknown }).default;

const logged: unknown[][] = [];
let container: HTMLElement;
let mounted: MountedComponent | undefined;
let events: unknown[][] = [];

/** Listeners that record each emit as `[name, ...args]`. */
const listening = (...names: string[]) =>
  Object.fromEntries(
    names.map((name) => [name, (...args: unknown[]) => void events.push([name, ...args])]),
  );

const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

/** Settles as the testing API does: the adapter's settle and two frames, until quiet. */
async function settle(): Promise<void> {
  for (let previous = ""; ;) {
    await mounted!.settle();
    await frame();
    await frame();
    const snapshot = `${container.innerHTML}|${events.length}`;
    if (snapshot === previous) return;
    previous = snapshot;
  }
}

async function act(action: () => Promise<unknown>): Promise<void> {
  await mounted!.interact!(action);
  await settle();
}

const status = () => container.querySelector("[role=status]")?.textContent;
const click = (name: string) =>
  act(() => userEvent.click(page.getByRole("button", { name, exact: true })));
const logEntries = () => [...container.querySelectorAll("li")].map((item) => item.textContent);

async function start(name: string, options: Parameters<typeof mount>[2] = {}): Promise<void> {
  mounted = await mount(await load(name), container, options);
  await settle();
}

beforeEach(() => {
  logged.length = 0;
  events = [];
  vi.spyOn(console, "warn").mockImplementation((...args) => void logged.push(args));
  vi.spyOn(console, "error").mockImplementation((...args) => void logged.push(args));
  container = document.createElement("div");
  document.body.append(container);
});

afterEach(async () => {
  await mounted?.unmount();
  mounted = undefined;
  container.remove();
  vi.restoreAllMocks();
  expect(logged).toEqual([]);
});

describe("read after write (ADR-0046)", () => {
  it("reads its own writes, a called function's, a derived value's, and after await", async () => {
    await start("Writes", { on: listening("read") });
    await click("Run");
    await expect.poll(() => events.length).toBe(5);
    expect(events).toEqual([
      ["read", "same", 1],
      ["read", "called", 11],
      ["read", "derived", 22],
      ["read", "awaited", 12],
      // A deferred callback reads the latest value, never a snapshot.
      ["read", "deferred", 13],
    ]);
    expect(container.querySelector("[role=status]")?.textContent).toBe("13");
  });

  it("reads in the bubble listener what the capture listener on the element wrote", async () => {
    await start("Writes", { on: listening("read") });
    await click("Phases");
    expect(events).toEqual([["read", "phases", 2]]);
    expect(container.textContent).toContain("capture then bubble");
  });
});

describe("watchers (ADR-0048)", () => {
  it("calls back once per handler, with the previous value, and cleans up before the next callback", async () => {
    await start("Watchers", { on: listening("searched", "cleaned", "total") });
    // The immediate watcher calls back at setup, with no previous value.
    expect(events).toEqual([["total", 3, undefined]]);
    events = [];
    await click("Boots");
    expect(events).toEqual([["searched", "boots", ""]]);
    events = [];
    // A write and its undoing in one handler: no callback, and no cleanup.
    await click("Boots");
    expect(events).toEqual([]);
    await click("Sandals");
    expect(events).toEqual([
      ["cleaned", "boots"],
      ["searched", "sandals", "boots"],
    ]);
    events = [];
    // A getter whose value stays the same calls nothing back; a change does.
    await click("Swap");
    expect(events).toEqual([]);
    await click("Raise");
    expect(events).toEqual([["total", 4, 3]]);
    events = [];
    // The last callback's cleanup runs on unmount.
    await mounted!.unmount();
    mounted = undefined;
    expect(events).toEqual([["cleaned", "sandals"]]);
  });
});

describe("lifecycle and effects (ADR-0048)", () => {
  it("runs onMounted once the DOM is in the document, and watchEffect after it and on changes", async () => {
    await start("Lifecycle", {
      props: { name: "Ada" },
      on: listening("mounted", "unmounted", "effect", "items"),
    });
    // The two hooks' relative order is no part of the contract (ADR-0048).
    expect(new Set(events.map((event) => JSON.stringify(event)))).toEqual(
      new Set([JSON.stringify(["effect", "Ada 0"]), JSON.stringify(["mounted", 10])]),
    );
    expect(events).toHaveLength(2);
    events = [];
    await click("Count");
    expect(events).toEqual([["effect", "Ada 1"]]);
    events = [];
    await mounted!.rerender({ name: "Grace" });
    await settle();
    expect(events).toEqual([["effect", "Grace 1"]]);
    events = [];
    await mounted!.unmount();
    mounted = undefined;
    expect(events).toEqual([["unmounted"]]);
  });

  it("reads the DOM after nextTick, and an empty ref once its element is gone", async () => {
    await start("Lifecycle", { props: { name: "Ada" }, on: listening("items") });
    await click("Toggle");
    await click("Toggle");
    expect(events).toEqual([
      ["items", 2],
      ["items", 0],
    ]);
  });
});

describe("listeners (ADR-0047)", () => {
  it("runs a container's capture listener before the target's, its bubble listener after", async () => {
    await start("Listeners");
    await click("Inside");
    expect(logEntries()).toEqual(["capture", "target", "bubble"]);
  });

  it("stops propagation while the event is dispatched", async () => {
    await start("Listeners");
    await click("Stop");
    expect(logEntries()).toEqual(["capture", "stopped"]);
  });

  it("runs a once listener once, its stopPropagation() with it", async () => {
    await start("Listeners");
    await click("Once");
    await click("Once");
    expect(logEntries()).toEqual(["once", "outer"]);
  });

  it("listens passively to the wheel", async () => {
    await start("Listeners");
    await act(() =>
      userEvent.wheel(page.getByRole("group", { name: "Wheel" }), { delta: { y: 50 } }),
    );
    expect(logEntries()).toEqual(["down"]);
  });

  it("prevents defaults while the event is dispatched, conditionally too, and reads currentTarget", async () => {
    await start("Listeners", { on: listening("submitted") });
    const field = page.getByRole("textbox", { name: "Draft" });
    await act(() => userEvent.type(field, "a,b"));
    expect((container.querySelector("input") as HTMLInputElement).value).toBe("ab");
    await act(() => userEvent.type(field, "{Enter}"));
    await click("Send");
    expect(events).toEqual([
      ["submitted", "ab"],
      ["submitted", "ab"],
    ]);
    await act(() => userEvent.click(page.getByRole("link", { name: "Link" })));
    expect(logEntries()).toEqual(["link"]);
    expect(location.pathname).not.toBe("/elsewhere");
  });

  it("prevents a default and reads currentTarget in a function a list's handler passes its event to", async () => {
    await start("Picker", {
      props: {
        choices: [
          { id: "a", label: "Ada" },
          { id: "g", label: "Grace" },
        ],
      },
      on: listening("picked"),
    });
    await act(() => userEvent.click(page.getByRole("link", { name: "Grace" })));
    expect(events).toEqual([["picked", "g", "Grace"]]);
    expect(container.querySelector("[role=status]")?.textContent).toBe("g");
    expect(location.pathname).not.toBe("/choices/g");
  });
});

describe("listener order across elements (ADR-0047)", () => {
  // The adapter models an app whose preloader has fetched the component's code (ADR-0050); the
  // order of listeners whose code has not run yet is Qwik's loader's, outside the contract.
  it("runs a descendant's listener before its container's", async () => {
    await start("Order");
    await click("Alpha");
    await click("Beta");
    expect(logEntries()).toEqual(["picked alpha #1", "picked beta #2"]);
  });

  it("runs one element's listeners in attribute order, before its container's", async () => {
    await start("Order");
    await click("Save");
    await click("Save");
    await click("Send");
    await click("Send");
    expect(logEntries()).toEqual([
      "save",
      "first save",
      "toolbar",
      "save",
      "toolbar",
      "first send",
      "send",
      "toolbar",
      "send",
      "toolbar",
    ]);
  });

  it("runs a container's listener after a descendant's async listener's synchronous part", async () => {
    await start("Order");
    await click("Save draft");
    // The container reads "saving": it waits for the listener's synchronous part, not for the
    // rest, which runs half a second later.
    expect(logEntries()).toEqual(["draft saving"]);
    await new Promise((resolve) => setTimeout(resolve, 600));
    await settle();
    expect(container.querySelector("output")?.textContent).toBe("saved");
  });

  it("stops a click in an element's bubble listener there, beside its capture listener", async () => {
    await start("Order");
    await click("Outside");
    await click("Inside");
    await click("Outside");
    expect(logEntries()).toEqual(["outside", "panel capture", "inside", "panel bubble", "outside"]);
  });

  it("runs a passive listener before its container's non-passive one", async () => {
    await start("Order");
    await act(() =>
      userEvent.wheel(page.getByRole("group", { name: "Inner zone" }), { delta: { y: 50 } }),
    );
    expect(logEntries()).toEqual(["inner wheel", "outer wheel"]);
  });

  it("keeps preventing a submission after a once listener's first run", async () => {
    await start("Order", { on: listening("welcomed", "submitted") });
    // After Qwik's loader, which listens in the capture phase; it prevents what it saw, so the
    // page stays.
    const prevented: boolean[] = [];
    const guard = (event: Event) => {
      prevented.push(event.defaultPrevented);
      event.preventDefault();
    };
    document.addEventListener("submit", guard);
    try {
      await click("Join");
      await click("Join");
    } finally {
      document.removeEventListener("submit", guard);
    }
    expect(prevented).toEqual([true, true]);
    expect(events).toEqual([["welcomed"], ["submitted", 1], ["submitted", 2]]);
  });
});

describe("calls of local functions (ADR-0045, ADR-0047)", () => {
  const field = () => container.querySelector("input") as HTMLInputElement;

  it("prevents only the key a helper's call tests for: typing still works", async () => {
    await start("Calls");
    const query = page.getByRole("textbox", { name: "Query" });
    await act(() => userEvent.type(query, "abc"));
    expect(field().value).toBe("abc");
    expect(status()).toBe("abc");
    await act(() => userEvent.type(query, "{Escape}"));
    expect(status()).toBe("");
  });

  it("goes on before an async function it calls without awaiting continues", async () => {
    await start("Calls");
    await click("Start");
    // `run()` wrote "running", the caller "started", then run's continuation "done".
    expect(container.querySelectorAll("p")[1]?.textContent).toBe("done");
  });

  it("narrows through a type predicate and an assertion function", async () => {
    await start("Calls");
    await click("Small");
    expect(container.querySelector("output")?.textContent).toBe("sm");
    await click("Medium");
    expect(container.querySelector("output")?.textContent).toBe("md");
  });
});

describe("a prop the parent passes after the mount (late-prop, unsupported)", () => {
  it("follows an optional prop the parent passes from the mount, `undefined` at first", async () => {
    await start("LatePage", { props: { page: undefined, total: 5 }, on: listening("pageChange") });
    await mounted!.rerender({ page: 3, total: 5 });
    await settle();
    expect(status()).toBe("Page 3 of 5");
    expect(events).toEqual([["pageChange", 3, 1]]);
  });

  // Qwik 2.0.0-beta.47's props proxy subscribes a reader only to the keys the props hold (core's
  // `PropsProxyHandler.get`), so this target declares `late-prop` unsupported. This test fails
  // once Qwik follows such a key: the cell can then be native.
  it("does not follow, in a computed or a task, a prop key the parent adds later", async () => {
    await start("LatePage", { props: { total: 5 }, on: listening("pageChange") });
    await mounted!.rerender({ page: 3, total: 5 });
    await settle();
    expect(container.textContent).toContain("Direct: 3");
    expect(status()).toBe("Page 1 of 5");
    expect(events).toEqual([]);
  });
});

describe("controls at dispatch and calls where another listener follows (ADR-0047)", () => {
  it("prevents only Enter in a guarded field, and runs its handler after its container's", async () => {
    await start("Guards");
    const tag = page.getByRole("textbox", { name: "Tag" });
    await act(() => userEvent.type(tag, "ab"));
    await act(() => userEvent.type(tag, "{Enter}"));
    expect((container.querySelector("input") as HTMLInputElement).value).toBe("ab");
    expect(container.textContent).toContain("Tags: ab");
    // The field's \`sync$\` prevents Enter as the event is dispatched, and Qwik's loader queues the
    // field's \`$\` handler behind it, after its container's handler: the container reads the
    // tags before Enter added one (declared on the semantics page; it fails once Qwik runs the
    // handler in the dispatch).
    expect(logEntries()).toEqual(["container a 0", "container b 0", "container Enter 0"]);
  });

  it("keeps a listener whose handler only prevents: the form is not submitted, the focus stays", async () => {
    await start("Bare");
    const submitted: boolean[] = [];
    const guard = (event: Event) => {
      submitted.push(event.defaultPrevented);
      event.preventDefault();
    };
    document.addEventListener("submit", guard);
    try {
      await click("Send");
    } finally {
      document.removeEventListener("submit", guard);
    }
    expect(submitted).toEqual([true]);
    const draft = page.getByRole("textbox", { name: "Draft" });
    await act(() => userEvent.click(draft));
    await click("Bold");
    expect(document.activeElement).toBe(container.querySelector("input[name=draft]"));
    expect(status()).toBe("1");
  });

  it("stops a click on a backdrop itself, and prevents a link's own click, at dispatch", async () => {
    await start("Guards");
    await click("Keep");
    expect(logEntries()).toEqual(["kept", "page"]);
    await act(() => userEvent.click(page.getByTestId("backdrop"), { position: { x: 2, y: 2 } }));
    expect(container.querySelector("[data-testid=backdrop]")).toBeNull();
    expect(logEntries()).toEqual(["kept", "page"]);
    const prevented: boolean[] = [];
    const guard = (event: Event) => {
      prevented.push(event.defaultPrevented);
      event.preventDefault();
    };
    document.addEventListener("click", guard);
    try {
      await act(() => userEvent.click(page.getByRole("link", { name: "Own link" })));
    } finally {
      document.removeEventListener("click", guard);
    }
    expect(prevented).toEqual([true]);
  });

  it("runs an unawaited async call's synchronous part before the caller goes on", async () => {
    // As an app's listener does once its code has loaded: the adapter resolves every QRL before
    // each action, so no test here sees a listener's first run, which ADR-0050 declares.
    await start("Guards", { on: listening("seen") });
    await click("Start");
    expect(events).toEqual([["seen", "saving start"]]);
  });

  it("returns no promise from an expression-bodied async call its container's listener follows", async () => {
    await start("Guards");
    await click("Save");
    // The container ran after the call's synchronous part, not after the whole of it.
    expect(logEntries()).toEqual(["page"]);
    expect(status()).toBe("saving inner");
    await new Promise((resolve) => setTimeout(resolve, 400));
    await settle();
    expect(status()).toBe("saved inner");
  });

  it("runs a listener that returns early beside a once listener", async () => {
    await start("Guards", { on: listening("saved", "firstSave") });
    await click("Save tags");
    const tag = page.getByRole("textbox", { name: "Tag" });
    await act(() => userEvent.type(tag, "x{Enter}"));
    await click("Save tags");
    expect(events).toEqual([["firstSave"], ["saved", 1]]);
  });
});

describe("tasks in source order, async watchers and effects (ADR-0048)", () => {
  it("runs hooks in source order, reading a computed declared after them", async () => {
    await start("Tasks", { on: listening("order") });
    expect(events).toEqual([
      ["order", "first doubled 0"],
      ["order", "second"],
    ]);
  });

  it("drops an async watcher's run that a new change overtakes, at once", async () => {
    await start("Tasks", { on: listening("looked", "dropped") });
    await click("Ann");
    await click("Anna");
    expect(events).toEqual([
      ["looked", "ann"],
      ["dropped", "ann"],
      ["looked", "anna"],
    ]);
    await click("Answer");
    expect(container.querySelector("[role=status]")?.textContent).toBe("anna: found");
  });

  it("runs a watchEffect once per change, and every cleanup before onUnmounted", async () => {
    await start("Tasks", { on: listening("summary", "teardown") });
    expect(events).toEqual([["summary", '0 for ""']]);
    events = [];
    await click("Ann");
    expect(events).toEqual([
      ["teardown", "effect"],
      ["summary", '2 for "ann"'],
    ]);
    events = [];
    await mounted!.unmount();
    mounted = undefined;
    expect(events).toEqual([
      ["teardown", "effect"],
      ["teardown", "unmounted"],
    ]);
  });
});
