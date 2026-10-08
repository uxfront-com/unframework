// The browser projects' stand-ins (no-output.ts), on a corpus of their own: which cases a target
// has no output for, the import a stand-in replaces, and what the stand-in does.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import type { Plugin } from "vite";
import { afterEach, describe, expect, it } from "vitest";

import { listCases } from "./cases.ts";
import { NO_OUTPUT_PREFIX, noOutputCases, noOutputPlugin, standIn } from "./no-output.ts";

let corpus: string | undefined;
afterEach(() => {
  if (corpus) rmSync(corpus, { recursive: true, force: true });
  corpus = undefined;
});

/** A corpus made of `files`, by path relative to the cases directory. */
function makeCorpus(files: Record<string, string>): string {
  corpus = mkdtempSync(join(tmpdir(), "uf-no-output-"));
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(corpus, path)), { recursive: true });
    writeFileSync(join(corpus, path), contents);
  }
  return corpus;
}

const input = "export default function Box() {\n  return <p>Box</p>;\n}\n";
const spec = 'it("renders", { requires: ["interactivity"] }, async () => {});\n';
const diagnostic = (code: string, severity: string, message: string, target?: string) => ({
  code,
  severity,
  message,
  ...(target ? { target } : {}),
});
const declared = "The qwik target does not support conditional-event-control: it runs apart.";

/** A corpus with a declared capability error on qwik, a diagnostics case and a clean case. */
function corpusOfFour(): string {
  return makeCorpus({
    "events/declared/Box.uf.tsx": input,
    "events/declared/declared.test.ts": spec,
    "events/declared/__expected__/diagnostics.json": JSON.stringify([
      diagnostic("UF4001", "info", "The astro target does not support interactivity.", "astro"),
      diagnostic("UF4001", "error", declared, "qwik"),
    ]),
    "events/everywhere/Box.uf.tsx": input,
    "events/everywhere/everywhere.test.ts": spec,
    "events/everywhere/__expected__/diagnostics.json": JSON.stringify([
      diagnostic("UF1002", "error", "Unsupported syntax."),
    ]),
    "diagnostics/broken/Box.uf.tsx": input,
    "diagnostics/broken/__expected__/diagnostics.json": JSON.stringify([
      diagnostic("UF1002", "error", "Unsupported syntax."),
    ]),
    "basics/clean/Box.uf.tsx": input,
    "basics/clean/clean.test.ts": spec,
    "basics/clean/__expected__/diagnostics.json": "[]",
  });
}

/** Calls the plugin's `resolveId` as Vite does. */
function resolveWith(
  plugin: Plugin,
  source: string,
  importer: string | undefined,
  scan = false,
): unknown {
  const hook = plugin.resolveId as (
    this: unknown,
    source: string,
    importer: string | undefined,
    options: { attributes: Record<string, string>; isEntry: boolean; scan?: boolean },
  ) => unknown;
  return hook.call({}, source, importer, {
    attributes: {},
    isEntry: false,
    ...(scan ? { scan: true } : {}),
  });
}

/** Calls the plugin's `load` as Vite does. */
function loadWith(plugin: Plugin, id: string): unknown {
  return (plugin.load as (this: unknown, id: string) => unknown).call({}, id);
}

describe("noOutputCases", () => {
  it("lists the cases with a spec whose expected diagnostics hold an error for the target", () => {
    const cases = listCases(corpusOfFour());
    expect(noOutputCases(cases, "qwik")).toEqual({
      "events/declared": `UF4001 (${declared})`,
      "events/everywhere": "UF1002 (Unsupported syntax.)",
    });
    // A note (Astro's inert interactivity) leaves the output: its tests run, or skip by capability.
    expect(Object.keys(noOutputCases(cases, "astro"))).toEqual(["events/everywhere"]);
    expect(Object.keys(noOutputCases(cases, "vue"))).toEqual(["events/everywhere"]);
  });

  it("leaves out a case whose expectations are missing, which the compile project writes first", () => {
    const cases = listCases(
      makeCorpus({ "events/new/Box.uf.tsx": input, "events/new/new.test.ts": spec }),
    );
    expect(noOutputCases(cases, "qwik")).toEqual({});
  });
});

describe("noOutputPlugin", () => {
  it("resolves a spec's import of such a component to a stand-in that loads, and nothing else", () => {
    const dir = corpusOfFour();
    const cases = listCases(dir);
    const plugin = noOutputPlugin(cases, noOutputCases(cases, "qwik"));
    const importer = join(dir, "events/declared/declared.test.ts");
    expect(plugin.enforce).toBe("pre");
    expect(resolveWith(plugin, "./Box.uf.tsx", importer)).toBe(
      `${NO_OUTPUT_PREFIX}events/declared`,
    );
    // The browser asks for the spec with Vite's queries.
    expect(resolveWith(plugin, "./Box.uf.tsx", `${importer}?import&browserv=1`)).toBe(
      `${NO_OUTPUT_PREFIX}events/declared`,
    );
    expect(resolveWith(plugin, "../declared/Box.uf.tsx", importer)).toBe(
      `${NO_OUTPUT_PREFIX}events/declared`,
    );
    // The dependency scan, a case the target compiles, another module and a bare specifier
    // are the unplugin's and Vite's.
    expect(resolveWith(plugin, "./Box.uf.tsx", importer, true)).toBeNull();
    expect(resolveWith(plugin, "./Box.uf.tsx", join(dir, "basics/clean/clean.test.ts"))).toBeNull();
    expect(resolveWith(plugin, "./helpers.ts", importer)).toBeNull();
    expect(resolveWith(plugin, "Box.uf.tsx", importer)).toBeNull();
    expect(resolveWith(plugin, "./Box.uf.tsx", undefined)).toBeNull();

    expect(loadWith(plugin, `${NO_OUTPUT_PREFIX}events/declared`)).toBe(
      standIn(`events/declared has no output for this target: it expects UF4001 (${declared}).`),
    );
    expect(loadWith(plugin, `${NO_OUTPUT_PREFIX}basics/clean`)).toBeNull();
    expect(loadWith(plugin, join(dir, "events/declared/Box.uf.tsx"))).toBeNull();
  });

  it("serves a component that throws the reason if anything renders it", async () => {
    const reason = 'events/declared has no qwik output: "quoted" and\nmultiline.';
    const module = (await import(
      `data:text/javascript,${encodeURIComponent(standIn(reason))}`
    )) as { default: () => unknown };
    expect(() => module.default()).toThrow(reason);
  });
});
