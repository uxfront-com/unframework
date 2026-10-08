import MessageListEvents from "virtual:uf-angular-events/effects/flush-post";
import ChannelPickerEvents from "virtual:uf-angular-events/effects/watch-cleanup";
import UnreadBadgeEvents from "virtual:uf-angular-events/effects/watch-effect";
import SectionHeadingEvents from "virtual:uf-angular-events/effects/watch-immediate";
import PriceRangeEvents from "virtual:uf-angular-events/effects/watch-sources";
import SaveDraftEvents from "virtual:uf-angular-events/events/async-handlers";
import ArticlePreviewEvents from "virtual:uf-angular-events/lifecycle/mounted-dom";
import ShippingDetailsEvents from "virtual:uf-angular-events/lifecycle/next-tick";
import AutoRefreshEvents from "virtual:uf-angular-events/lifecycle/unmount-timers";
import AsyncEffectsEvents from "virtual:uf-angular-events/probe/AsyncEffects";
import ElementsEvents from "virtual:uf-angular-events/probe/Elements";
import InlineEditorEvents from "virtual:uf-angular-events/probe/InlineEditor";
import TeardownsEvents from "virtual:uf-angular-events/probe/Teardowns";
import TuplesEvents from "virtual:uf-angular-events/probe/Tuples";
import TemperatureEvents from "virtual:uf-angular-events/semantics/derived-from-props";
import SearchPagerEvents from "virtual:uf-angular-events/semantics/watch-timing";
import MessageList from "virtual:uf-angular/effects/flush-post";
import ChannelPicker from "virtual:uf-angular/effects/watch-cleanup";
import UnreadBadge from "virtual:uf-angular/effects/watch-effect";
import SectionHeading from "virtual:uf-angular/effects/watch-immediate";
import ZoomControl from "virtual:uf-angular/effects/watch-previous";
import PriceRange from "virtual:uf-angular/effects/watch-sources";
import SaveDraft from "virtual:uf-angular/events/async-handlers";
import ArticlePreview from "virtual:uf-angular/lifecycle/mounted-dom";
import ShippingDetails from "virtual:uf-angular/lifecycle/next-tick";
import AutoRefresh from "virtual:uf-angular/lifecycle/unmount-timers";
import AsyncEffects from "virtual:uf-angular/probe/AsyncEffects";
import Elements from "virtual:uf-angular/probe/Elements";
import InlineEditor from "virtual:uf-angular/probe/InlineEditor";
import Teardowns from "virtual:uf-angular/probe/Teardowns";
import Tuples from "virtual:uf-angular/probe/Tuples";
import Temperature from "virtual:uf-angular/semantics/derived-from-props";
import NetworkBadge from "virtual:uf-angular/semantics/effects-client-only";
import SearchPager from "virtual:uf-angular/semantics/watch-timing";
// Watchers, `watchEffect` and lifecycle hooks as the Angular output runs them in Chromium
// (ADR-0048, the semantics contract of plan §4.5): a watcher's callback runs once for the writes
// of one handler, only when its source's value changed (`Object.is`), with the value its source
// had at its last callback; its cleanup runs right before its next callback and at destruction,
// never for a write that changes nothing; an immediate one runs at setup; `flush: "post"` and
// `watchEffect` run after the DOM has updated; `onMounted` runs with the DOM in the document and
// `onUnmounted` when the component goes; `nextTick()` resolves once the DOM has updated.
import { afterEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import { cleanup, render } from "./browser.ts";

afterEach(cleanup);

describe("watch", () => {
  it("runs once per handler, only on a change, with the previous value", async () => {
    const view = await render(SearchPager, SearchPagerEvents);
    // `query` written twice in one handler; `page` written to the value it has.
    await view.click("button", "Search boots");
    await view.click("button", "Next page");
    await view.click("button", "Skip two pages");
    expect(view.events).toEqual([
      ["queryRun", "boots", ""],
      ["pageRun", 2, 1],
      ["pageRun", 4, 2],
    ]);
  });

  it("runs its cleanup right before its next callback, never for a value written back", async () => {
    const view = await render(SearchPager, SearchPagerEvents);
    await view.click("button", "Search boots");
    await view.click("button", "Next page");
    // `page` goes back to 1 and `query` changes: one callback each, the cleanup first.
    await view.click("button", "Search sandals");
    expect(view.events.slice(2)).toEqual([
      ["cleanedUp", "query"],
      ["queryRun", "sandals", "boots"],
      ["pageRun", 1, 2],
    ]);
  });

  it("keeps the previous value of each callback", async () => {
    const view = await render(ZoomControl, []);
    await view.click("button", "Zoom in");
    await view.click("button", "Zoom in");
    await view.click("button", "Zoom out");
    await view.click("button", "Reset");
    // Resetting to the value the zoom has runs no callback.
    await view.click("button", "Reset");
    expect([...view.container.querySelectorAll("li")].map((li) => li.textContent)).toEqual([
      "100% to 125%",
      "125% to 150%",
      "150% to 125%",
      "125% to 100%",
    ]);
  });

  it("runs an immediate getter at setup, and its cleanup before the next and at unmount", async () => {
    const view = await render(ChannelPicker, ChannelPickerEvents);
    expect(view.events).toEqual([["join", "general"]]);
    // "General" lower-cased is the value the getter has: nothing runs.
    await view.click("button", "Join #General");
    expect(view.events).toEqual([["join", "general"]]);
    await view.click("button", "Join #random");
    expect(view.events.slice(1)).toEqual([
      ["leave", "general"],
      ["join", "random"],
    ]);
    await view.unmount();
    expect(view.events.slice(3)).toEqual([["leave", "random"]]);
  });

  it("runs an immediate watcher of an input at setup, then on each change", async () => {
    const view = await render(SectionHeading, SectionHeadingEvents, { title: "Introduction" });
    await view.rerender({ title: "Setup" });
    expect(view.emitted("change")).toEqual([
      ["Introduction", undefined],
      ["Setup", "Introduction"],
    ]);
    expect(view.emitted("ready")).toEqual([[]]);
  });

  it("watches a getter over two signals, an array of signals and an input", async () => {
    const view = await render(PriceRange, PriceRangeEvents, { currency: "EUR" });
    // Both ends move: the span stays, the range runs once for the two writes.
    await view.click("button", "Shift up");
    await view.click("button", "Widen");
    await view.rerender({ currency: "USD" });
    expect(view.events).toEqual([
      ["rangeUpdate", 20, 60],
      ["spanUpdate", 50],
      ["rangeUpdate", 20, 70],
      ["currencyUpdate", "USD"],
    ]);
  });

  it("runs a watcher of an input on a rerender, with the previous value", async () => {
    const view = await render(Temperature, TemperatureEvents, { celsius: 20 });
    await view.rerender({ celsius: 35 });
    await view.rerender({ celsius: 2 });
    expect(view.get("figure").dataset.level).toBe("cold");
    expect(view.emitted("reading")).toEqual([
      [35, 20],
      [2, 35],
    ]);
  });

  it('reads the updated DOM with `flush: "post"`', async () => {
    const view = await render(MessageList, MessageListEvents);
    await view.click("button", "Add a message");
    await view.click("button", "Add a message");
    expect(view.emitted("rendered")).toEqual([[2], [3]]);
  });

  it("changes in the browser what the server rendered: a watcher fed by `onMounted`", async () => {
    const view = await render(NetworkBadge, []);
    const badge = view.get('[role="status"]');
    expect(badge.textContent).toBe(navigator.onLine ? "Online" : "Offline");
    expect(badge.dataset.checked).toBe("yes");
  });
});

describe("watchEffect", () => {
  it("runs after the render and after each change of what it reads, its cleanup first", async () => {
    const view = await render(UnreadBadge, UnreadBadgeEvents, { appName: "Inbox" });
    await view.click("button", "Receive a message");
    // Writing the value it has re-runs nothing.
    await view.click("button", "Mark all read");
    await view.click("button", "Mark all read");
    await view.rerender({ appName: "Mail" });
    expect(view.events).toEqual([
      ["titleChange", "(0) Inbox"],
      ["titleRelease", "(0) Inbox"],
      ["titleChange", "(1) Inbox"],
      ["titleRelease", "(1) Inbox"],
      ["titleChange", "(0) Inbox"],
      ["titleRelease", "(0) Inbox"],
      ["titleChange", "(0) Mail"],
    ]);
  });
});

describe("lifecycle", () => {
  it("runs `onMounted` once, with the DOM in the document", async () => {
    const text = "Signals make Angular state explicit.";
    const view = await render(ArticlePreview, ArticlePreviewEvents, { title: "Signals", text });
    await view.rerender({ title: "Signals", text: "Shorter." });
    expect(view.emitted("ready")).toEqual([[text.length]]);
    expect(view.get('[role="status"]').textContent).toBe(`${text.length} characters`);
  });

  it("runs `onUnmounted` when the component goes: the timer stops", async () => {
    const view = await render(AutoRefresh, AutoRefreshEvents, { interval: 20 });
    await view.click("button", "Auto-refresh");
    await expect.poll(() => view.emitted("refresh").length).toBeGreaterThanOrEqual(2);
    await view.unmount();
    const ticks = view.emitted("refresh").length;
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(view.emitted("refresh")).toHaveLength(ticks);
  });

  it("resolves `nextTick()` once the DOM has updated, the ref empty once its element goes", async () => {
    const view = await render(ShippingDetails, ShippingDetailsEvents);
    await view.click("button", "Shipping details");
    await expect.poll(() => view.emitted("toggled")).toEqual([[3]]);
    await view.click("button", "Shipping details");
    await expect.poll(() => view.emitted("toggled")).toEqual([[3], [0]]);
  });

  it("writes, awaits a promise and `nextTick()`, and reads its own writes after", async () => {
    const view = await render(SaveDraft, SaveDraftEvents);
    await view.click("button", "Save the draft");
    await expect.poll(() => view.emitted("saved")).toEqual([[1, "Saved, attempt 1"]]);
    // The write after `nextTick()` renders in Angular's next change detection.
    await view.mounted.settle();
    expect(view.get('[role="status"]').textContent).toBe("Saved, attempt 1");
  });
});

describe("nextTick", () => {
  it("resumes in the task that rendered, before the next event of the same key", async () => {
    const view = await render(InlineEditor, InlineEditorEvents);
    await userEvent.click(view.get("button", "Rename"));
    await expect.poll(() => view.emitted("focused")).toEqual([["Name"]]);
    // Enter's `keydown` renames and moves the focus to Rename once the DOM shows it: before the
    // key's `keypress`, whose activation clicks the button, as on Vue.
    await userEvent.keyboard("Budget{Enter}");
    await view.mounted.settle();
    expect(view.emitted("renamed")).toEqual([["Budget"]]);
    await expect.poll(() => view.emitted("focused")).toEqual([["Name"], ["Rename"], ["Name"]]);
    expect(document.activeElement).toBe(view.get("input"));
  });
});

describe("async callbacks", () => {
  it("runs an async watch callback and an async `watchEffect` past their `await`", async () => {
    const view = await render(AsyncEffects, AsyncEffectsEvents, { id: 1 });
    // The effect read `count` before its `await`: it tracked it, and runs again on a change.
    await expect.poll(() => view.emitted("seen")).toEqual([[0]]);
    await view.click("button", "Add");
    await expect.poll(() => view.emitted("saved")).toEqual([[1]]);
    await expect.poll(() => view.emitted("seen")).toEqual([[0], [1]]);
    await view.rerender({ id: 2 });
    await expect.poll(() => view.emitted("loaded")).toEqual([["User 2"]]);
    expect(view.get("p").textContent).toBe("User 2");
  });
});

describe("array sources", () => {
  it("hands the callback its values and the previous ones as mutable tuples, annotated or not", async () => {
    const view = await render(Tuples, TuplesEvents, { label: "a" });
    await expect
      .poll(() => view.emitted("seen"))
      .toEqual([
        [0, "a", "-/-"],
        [0, "a", "-/-"],
      ]);
    await view.click("button", "Move");
    expect(view.get("output").textContent).toBe("a:0>a:1 1/a 1+a<0+a 2A a@1");
    await view.rerender({ label: "b" });
    expect(view.get("output").textContent).toBe(
      "a:0>a:1 1/a 1+a<0+a 2A a@1 a:1>b:1 1/b 1+b<1+a 2B b@1",
    );
    expect(view.get("p").textContent).toBe("2");
    expect(view.emitted("seen")).toEqual([
      [0, "a", "-/-"],
      [0, "a", "-/-"],
      [1, "a", "0/a"],
      [1, "a", "0/a"],
      [1, "b", "1/a"],
      [1, "b", "1/a"],
    ]);
  });
});

describe("template refs", () => {
  it("keep, pass, return and compare an element as the source does, `null` when empty", async () => {
    const view = await render(Elements, ElementsEvents);
    await expect.poll(() => view.emitted("found")).toEqual([[true]]);
    expect(view.get("p").textContent).toBe("seen");
    await view.click("button", "Handle");
    expect(view.emitted("handled")).toEqual([[]]);
  });
});

describe("callbacks that return", () => {
  it("run as the source's, and every `onUnmounted` runs whatever an earlier one returned", async () => {
    const view = await render(Teardowns, TeardownsEvents);
    expect(view.get("p").textContent).toBe("1");
    for (let click = 0; click < 3; click++) await view.click("button", "More");
    expect(view.emitted("counted")).toEqual([[1], [2]]);
    expect(view.get("p").textContent).toBe("2");
    await view.unmount();
    expect(view.emitted("stopped")).toEqual([["second"]]);
  });
});
