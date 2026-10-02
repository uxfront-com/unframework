import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import type { HarnessContext } from "../src/harness.ts";
import { parityBrowser } from "../src/node/browser.ts";
import { ufAriaSnapshot, ufArtefact } from "../src/node/commands.ts";
import type { CommandProject } from "../src/node/context.ts";

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

describe("parityBrowser", () => {
  it("registers the testing API's commands and a target's own", () => {
    const ufAstroRender = () => "<p>x</p>";
    const browser = parityBrowser({ name: "browser:astro", commands: { ufAstroRender } });
    expect(Object.keys(browser.commands ?? {}).sort()).toEqual([
      "ufAriaSnapshot",
      "ufArtefact",
      "ufAstroRender",
      "ufVisualCapture",
    ]);
    expect(browser.commands?.ufArtefact).toBe(ufArtefact);
  });

  it("refuses a target command that would replace one of the testing API's", () => {
    expect(() =>
      parityBrowser({ name: "browser:x", commands: { ufArtefact: () => ({ pass: true }) } }),
    ).toThrow(/parityBrowser\(browser:x\): ufArtefact would replace the testing API's own/);
  });
});
