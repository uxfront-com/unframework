import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { UfModule } from "@unframework/ir";
import { beforeEach, describe, expect, it } from "vitest";

import type { HarnessContext } from "../src/harness.ts";
import { ACTION_TIMEOUT, parityBrowser } from "../src/node/browser.ts";
import {
  ufAriaSnapshot,
  ufArtefact,
  ufComponentEvents,
  ufFocus,
  ufInput,
  ufResetInput,
} from "../src/node/commands.ts";
import type { CommandProject } from "../src/node/context.ts";
import { compiledEvents, eventsOfModule, recordCompiledModule } from "../src/node/events.ts";

let harness: HarnessContext;

beforeEach(() => {
  const root = mkdtempSync(join(tmpdir(), "uf-commands-"));
  harness = {
    runId: "run-1",
    casesDir: join(root, "cases"),
    reference: "vue",
    update: false,
    pixels: "live",
    canary: null,
    baselineEnvironment: null,
    ledgerDir: join(root, ".reports", "ledger", "run-1"),
    liveDir: join(root, ".live", "run-1"),
    diffsDir: join(root, ".reports", "diffs", "run-1"),
    quarantine: [],
    cases: { "basics/hello": {} },
  };
  mkdirSync(join(harness.casesDir, "basics", "hello", "__expected__"), { recursive: true });
});

const project = (target: string, overrides: Partial<HarnessContext> = {}): CommandProject => ({
  project: {
    name: `browser:${target}`,
    getProvidedContext: () => ({ target, ufHarness: { ...harness, ...overrides } }),
  },
});
const expected = () =>
  join(harness.casesDir, "basics", "hello", "__expected__", "dom.initial.html");

describe("ufArtefact", () => {
  it("compares against the committed artefact in check mode", () => {
    writeFileSync(expected(), "<p>Hi</p>\n");
    const request = { case: "basics/hello", file: "dom.initial.html", contents: "<p>Hi</p>\n" };
    expect(ufArtefact(project("react"), request)).toEqual({
      pass: true,
      status: "matched",
      message: "",
    });
    const outcome = ufArtefact(project("react"), { ...request, contents: "<p>Bye</p>\n" });
    expect(outcome.pass).toBe(false);
    expect(outcome.message).toContain("cases/basics/hello/__expected__/dom.initial.html differs");
  });

  it("lets only the reference write in update mode, and the followers compare with it", () => {
    const request = { case: "basics/hello", file: "dom.initial.html", contents: "<p>Hi</p>\n" };
    const follower = ufArtefact(project("react", { update: true }), request);
    expect(follower.status).toBe("missing-reference");
    expect(existsSync(expected())).toBe(false);

    expect(ufArtefact(project("vue", { update: true }), request).status).toBe("written");
    expect(readFileSync(expected(), "utf8")).toBe("<p>Hi</p>\n");
    expect(ufArtefact(project("react", { update: true }), request).status).toBe("matched");
    expect(
      ufArtefact(project("svelte", { update: true }), { ...request, contents: "<p>x</p>\n" })
        .status,
    ).toBe("mismatch");
    expect(readFileSync(expected(), "utf8")).toBe("<p>Hi</p>\n");
  });

  it("settles a trace, and a trace that must not exist", () => {
    const trace = join(
      harness.casesDir,
      "basics",
      "hello",
      "__expected__",
      "trace.after-click.json",
    );
    const request = { case: "basics/hello", file: "trace.after-click.json", contents: "{}\n" };
    expect(ufArtefact(project("vue", { update: true }), request).status).toBe("written");
    expect(readFileSync(trace, "utf8")).toBe("{}\n");
    // No steps led to the scenario: the reference deletes the trace, and a follower may not find it.
    const none = { ...request, contents: null };
    expect(ufArtefact(project("vue", { update: true }), none).status).toBe("written");
    expect(existsSync(trace)).toBe(false);
    expect(ufArtefact(project("react", { update: true }), none).status).toBe("matched");
    writeFileSync(trace, "{}\n");
    expect(ufArtefact(project("react"), none)).toMatchObject({
      pass: false,
      status: "stale",
      message: expect.stringContaining(
        "Stale artefact cases/basics/hello/__expected__/trace.after-click.json",
      ),
    });
    // Only a trace may be absent.
    expect(() =>
      ufArtefact(project("vue"), {
        case: "basics/hello",
        file: "dom.initial.html",
        contents: null,
      }),
    ).toThrow(/only a trace may be absent/);
  });

  it("refuses files that are not browser artefacts, and unknown cases", () => {
    const base = { case: "basics/hello", contents: "x" };
    for (const file of [
      "ssr.default.html",
      "../../escape.html",
      "dom.Initial.html",
      "dom.after--click.html",
      "aria.open-.yaml",
      "dom.a.b.html",
      "geometry.initial.json",
      "trace.Initial.json",
      "trace.initial.yaml",
    ]) {
      expect(() => ufArtefact(project("vue"), { ...base, file })).toThrow(/not a browser artefact/);
    }
    expect(() =>
      ufArtefact(project("vue"), { case: "basics/../..", file: "dom.initial.html", contents: "" }),
    ).toThrow(/Unknown case/);
  });

  it("refuses projects that do not provide the harness context", () => {
    const bare: CommandProject = { project: { name: "unit", getProvidedContext: () => ({}) } };
    expect(() =>
      ufArtefact(bare, { case: "basics/hello", file: "dom.initial.html", contents: "" }),
    ).toThrow(/does not provide "target" and "ufHarness"/);
  });
});

describe("ufAriaSnapshot", () => {
  it("takes Playwright's snapshot of the locator's selector in the tester iframe", async () => {
    const selectors: string[] = [];
    const context = {
      iframe: {
        locator(selector: string) {
          selectors.push(selector);
          return { ariaSnapshot: async () => "- paragraph: Hello, world!" };
        },
      },
    };
    const snapshot = await ufAriaSnapshot(context, {
      selector: 'internal:testid=[data-testid="uf-root-1"s]',
      locator: 'getByTestId("uf-root-1")',
    });
    expect(snapshot).toBe("- paragraph: Hello, world!");
    expect(selectors).toEqual(['internal:testid=[data-testid="uf-root-1"s]']);
  });
});

describe("ufFocus and ufResetInput", () => {
  it("focuses the locator's selector in the tester iframe", async () => {
    const focused: string[] = [];
    const context = {
      iframe: {
        locator: (selector: string) => ({
          focus: async () => void focused.push(selector),
        }),
      },
    };
    await ufFocus(context, { selector: "internal:role=textbox", locator: "getByRole('textbox')" });
    expect(focused).toEqual(["internal:role=textbox"]);
  });

  it("moves the mouse to the bottom right corner of the tester frame", async () => {
    const moves: [number, number][] = [];
    const context = (box: { x: number; y: number; width: number; height: number } | null) => ({
      page: { mouse: { move: async (x: number, y: number) => void moves.push([x, y]) } },
      frame: async () => ({ frameElement: async () => ({ boundingBox: async () => box }) }),
    });
    await ufResetInput(context({ x: 10, y: 20, width: 800, height: 600 }));
    // A frame the page does not lay out falls back to the viewport, at the page's origin.
    await ufResetInput(context(null));
    expect(moves).toEqual([
      [809, 619],
      [799, 599],
    ]);
  });
});

describe("ufInput", () => {
  /** A command context that logs every Playwright call, and knows no key in `unknown`. */
  const recording = (unknown: readonly string[] = []) => {
    const calls: string[] = [];
    const context = {
      page: {
        mouse: {
          down: async ({ clickCount }: { clickCount: number }) =>
            void calls.push(`down ${clickCount}`),
          up: async ({ clickCount }: { clickCount: number }) => void calls.push(`up ${clickCount}`),
          wheel: async (x: number, y: number) => void calls.push(`wheel ${x} ${y}`),
        },
        keyboard: {
          down: async (key: string) => {
            // Playwright's refusal, as its client rethrows it.
            if (unknown.includes(key)) throw new Error(`keyboard.down: Unknown key: "${key}"`);
            calls.push(`keydown ${key}`);
          },
          up: async (key: string) => void calls.push(`keyup ${key}`),
          insertText: async (text: string) => void calls.push(`insert ${text}`),
        },
      },
      iframe: {
        locator: (selector: string) => ({
          isEnabled: async () => {
            calls.push(`enabled ${selector}`);
            return !selector.includes("disabled");
          },
          hover: async (options: object) =>
            void calls.push(`hover ${selector} ${JSON.stringify(options)}`),
        }),
      },
    };
    return { calls, context };
  };
  const button = { selector: "internal:role=button", locator: "getByRole('button')" };

  it("moves onto an element as Playwright's hover does, then presses where it is", async () => {
    const { calls, context } = recording();
    await ufInput(context, { kind: "move", locator: button, check: "click" });
    await ufInput(context, { kind: "press", clickCount: 1 });
    await ufInput(context, { kind: "release", clickCount: 1 });
    await ufInput(context, {
      kind: "move",
      locator: button,
      position: { x: 4, y: 4 },
      check: "hover",
    });
    await ufInput(context, { kind: "wheel", deltaX: 0, deltaY: 100 });
    expect(calls).toEqual([
      "hover internal:role=button {}",
      "enabled internal:role=button",
      "down 1",
      "up 1",
      'hover internal:role=button {"position":{"x":4,"y":4}}',
      "wheel 0 100",
    ]);
  });

  it("refuses a disabled element before a click, as Playwright's click would", async () => {
    const { calls, context } = recording();
    const disabled = { selector: "internal:role=button[disabled]", locator: "getByRole('button')" };
    await expect(
      ufInput(context, { kind: "move", locator: disabled, check: "click" }),
    ).rejects.toThrow("getByRole('button') is disabled: a click on it would do nothing.");
    // A hover is no click: a disabled element takes it.
    await ufInput(context, { kind: "move", locator: disabled, check: "hover" });
    expect(calls).toEqual([
      "hover internal:role=button[disabled] {}",
      "enabled internal:role=button[disabled]",
      "hover internal:role=button[disabled] {}",
    ]);
  });

  it("presses a key, and inserts a character the layout lacks as text with no key", async () => {
    const { calls, context } = recording(["é", "Nope"]);
    expect(await ufInput(context, { kind: "keydown", key: "a", text: true })).toEqual({
      inserted: false,
    });
    expect(await ufInput(context, { kind: "keyup", key: "a", text: true })).toEqual({
      inserted: false,
    });
    expect(await ufInput(context, { kind: "keydown", key: "é", text: true })).toEqual({
      inserted: true,
    });
    // A key's name Playwright does not know is a mistake in the spec, never text.
    await expect(ufInput(context, { kind: "keydown", key: "Nope", text: false })).rejects.toThrow(
      'Unknown key: "Nope"',
    );
    expect(calls).toEqual(["keydown a", "keyup a", "insert é"]);
  });
});

describe("ufComponentEvents", () => {
  /** A module of one component that declares `events`, as the IR has them. */
  const module = (file: string, ...events: { name: string; optional: boolean[] }[][]) =>
    ({
      irVersion: 1,
      file,
      exports: [],
      types: [],
      components: events.map((list, index) => ({
        name: `C${index}`,
        ...(list.length
          ? {
              emits: {
                events: list.map(({ name, optional }) => ({
                  name,
                  parameters: optional.map((flag, member) => ({
                    name: `m${member}`,
                    ...(flag ? { optional: true } : {}),
                  })),
                })),
              },
            }
          : {}),
      })),
    }) as unknown as UfModule;

  it("answers with the events of the project's own compile of the case's module", () => {
    const source = join(harness.casesDir, "basics", "hello", "Hello.uf.tsx");
    writeFileSync(source, "");
    expect(() => ufComponentEvents(project("vue"), { case: "basics/hello" })).toThrow(
      /No vue compile of .*Hello\.uf\.tsx was recorded/,
    );
    recordCompiledModule({
      file: source,
      target: "vue",
      ir: module("basics/hello/Hello.uf.tsx", [
        { name: "change", optional: [false] },
        { name: "ping", optional: [true] },
      ]),
    });
    expect(ufComponentEvents(project("vue"), { case: "basics/hello" })).toEqual({
      events: [
        { name: "change", optional: [false] },
        { name: "ping", optional: [true] },
      ],
    });
    // Each target's compile is its own: react's was not recorded.
    expect(() => compiledEvents(source, "react")).toThrow(/No react compile/);
    recordCompiledModule({ file: source, target: "react", ir: undefined });
    expect(() => compiledEvents(source, "react")).toThrow(/produced no IR/);
  });

  it("answers with the events of the main source of a case of several (ADR-0057)", () => {
    const directory = join(harness.casesDir, "forms", "form");
    mkdirSync(directory, { recursive: true });
    const form = join(directory, "Form.uf.tsx");
    const field = join(directory, "Field.uf.tsx");
    writeFileSync(form, "");
    writeFileSync(field, "");
    recordCompiledModule({
      file: form,
      target: "vue",
      ir: module("forms/form/Form.uf.tsx", [{ name: "submit", optional: [] }]),
    });
    recordCompiledModule({
      file: field,
      target: "vue",
      ir: module("forms/form/Field.uf.tsx", [{ name: "clear", optional: [] }]),
    });
    const cases = (config: HarnessContext["cases"][string]) => ({
      cases: { ...harness.cases, "forms/form": config },
    });
    expect(
      ufComponentEvents(project("vue", cases({ main: "Form.uf.tsx" })), { case: "forms/form" }),
    ).toEqual({ events: [{ name: "submit", optional: [] }] });
    expect(() => ufComponentEvents(project("vue", cases({})), { case: "forms/form" })).toThrow(
      "[uf] Case forms/form must hold one .uf.tsx input, or name its main one in case.json, to mount; found 2.",
    );
    expect(() =>
      ufComponentEvents(project("vue", cases({ main: "Missing.uf.tsx" })), { case: "forms/form" }),
    ).toThrow(
      "[uf] Case forms/form names Missing.uf.tsx as its main input, which it does not hold.",
    );
  });

  it("refuses a module whose components declare different events", () => {
    expect(eventsOfModule(module("a.uf.tsx", [], []))).toEqual([]);
    expect(() =>
      eventsOfModule(module("a.uf.tsx", [{ name: "change", optional: [] }], [])),
    ).toThrow(/holds 2 components that declare different events/);
  });
});

describe("parityBrowser", () => {
  it("registers the testing API's commands and a target's own", () => {
    const ufAstroRender = () => "<p>x</p>";
    const browser = parityBrowser({ name: "browser:astro", commands: { ufAstroRender } });
    expect(Object.keys(browser.commands ?? {}).sort()).toEqual([
      "ufAriaSnapshot",
      "ufArtefact",
      "ufAstroRender",
      "ufComponentEvents",
      "ufFocus",
      "ufInput",
      "ufResetInput",
      "ufVisualCapture",
    ]);
    expect(browser.commands?.ufArtefact).toBe(ufArtefact);
  });

  it("bounds every action by the action timeout, as an assertion is bounded by the poll's", () => {
    expect(ACTION_TIMEOUT).toBe(5_000);
    const provider = parityBrowser({ name: "browser:vue" }).provider as unknown as {
      options: { actionTimeout?: number };
    };
    expect(provider.options.actionTimeout).toBe(ACTION_TIMEOUT);
  });

  it("launches Chromium without font hinting and with whole-tile raster, for the captures", () => {
    const provider = parityBrowser({ name: "browser:vue" }).provider as unknown as {
      options: { launchOptions?: { args?: string[] } };
    };
    // Partial raster made a capture depend on what was repainted before it (stub/raster).
    expect(provider.options.launchOptions?.args).toEqual([
      "--font-render-hinting=none",
      "--disable-partial-raster",
    ]);
  });

  it("refuses a target command that would replace one of the testing API's", () => {
    expect(() =>
      parityBrowser({ name: "browser:x", commands: { ufArtefact: () => ({ pass: true }) } }),
    ).toThrow(/parityBrowser\(browser:x\): ufArtefact would replace the testing API's own/);
  });
});
