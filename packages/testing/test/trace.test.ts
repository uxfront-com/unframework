// A view's trace (L9, ADR-0050): each step records the DOM, the ARIA tree and the events since
// the step before; `expectParity` takes the steps since the previous one; a test that ends with
// steps no one took fails L9; and the file is pretty JSON, so a diff names the line.
import { describe, expect, it } from "vitest";

import type { EmittedEvent } from "../src/browser/events.ts";
import { closeTraces, Trace, TRACE_VERSION, traceFile } from "../src/browser/trace.ts";

/** A trace over a fake view whose DOM and events the test sets. */
function fake() {
  const state = { html: '<p>\n  "0"\n</p>\n', ids: new Map<string, string>() };
  const events: EmittedEvent[] = [];
  const trace = new Trace({
    root: "uf-root-7",
    dom: () => ({ html: state.html, ids: state.ids }),
    aria: async () => '- paragraph: "0"',
    events,
  });
  return { state, events, trace };
}

describe("Trace", () => {
  it("records each step with the events since the step before, and gives them up once", async () => {
    closeTraces();
    const { state, events, trace } = fake();
    events.push({ name: "change", args: [1] }, { name: "close", args: [] });
    await trace.record("click getByRole('button')");
    state.html = '<p>\n  "1"\n</p>\n';
    events.push({ name: "change", args: [2] });
    await trace.record('keyboard "{Enter}"');
    expect(trace.take()).toEqual([
      {
        action: "click getByRole('button')",
        dom: ["<p>", '  "0"', "</p>"],
        aria: ['- paragraph: "0"'],
        events: { change: [[1]], close: [[]] },
      },
      {
        action: 'keyboard "{Enter}"',
        dom: ["<p>", '  "1"', "</p>"],
        aria: ['- paragraph: "0"'],
        events: { change: [[2]] },
      },
    ]);
    expect(trace.take()).toEqual([]);
    expect(closeTraces()).toEqual([]);
  });

  it("renames the generated ids a payload carries as the step's DOM does", async () => {
    const { state, events, trace } = fake();
    state.ids = new Map([["uf-id-_r_0_", "uf-id-1"]]);
    events.push({ name: "ready", args: ["uf-id-_r_0_", "uf-id-other"] });
    await trace.record("rerender {}");
    expect(trace.take()[0]?.events).toEqual({ ready: [["uf-id-1", "uf-id-2"]] });
    // The step's renaming is its own: the DOM's map is left as it was.
    expect([...state.ids.keys()]).toEqual(["uf-id-_r_0_"]);
    closeTraces();
  });

  it("renames the generated ids the ARIA tree carries as the step's DOM does", async () => {
    const state = {
      html: '<a href="#uf-id-1">\n  "Skip"\n</a>\n',
      ids: new Map([["uf-id-v-0", "uf-id-1"]]),
    };
    const trace = new Trace({
      root: "uf-root-8",
      dom: () => state,
      aria: async () => '- link "Skip uf-id-v-0":\n  - /url: "#uf-id-v-0"\n- text: uf-id-v-9',
      events: [],
    });
    await trace.record("click getByRole('link')");
    expect(trace.take()[0]?.aria).toEqual([
      '- link "Skip uf-id-1":',
      '  - /url: "#uf-id-1"',
      "- text: uf-id-2",
    ]);
    closeTraces();
  });

  it("fails L9 with the steps a test left uncompared, once", async () => {
    closeTraces();
    const { trace } = fake();
    await trace.record("click getByRole('button')");
    await trace.record("rerender {}");
    expect(closeTraces()).toEqual([
      "2 step(s) of uf-root-7 were never compared (click getByRole('button'); rerender {}): every view.user action and rerender is followed by an expectParity, which compares its trace.",
    ]);
    expect(closeTraces()).toEqual([]);
  });
});

describe("traceFile", () => {
  it("writes versioned, pretty JSON with one trailing line break", () => {
    const text = traceFile([{ action: "tab", dom: [], aria: [], events: {} }]);
    expect(JSON.parse(text)).toEqual({
      version: TRACE_VERSION,
      steps: [{ action: "tab", dom: [], aria: [], events: {} }],
    });
    expect(text).toBe(
      '{\n  "version": 1,\n  "steps": [\n    {\n      "action": "tab",\n      "dom": [],\n      "aria": [],\n      "events": {}\n    }\n  ]\n}\n',
    );
  });
});
