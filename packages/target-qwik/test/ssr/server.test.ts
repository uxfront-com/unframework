import { afterEach, describe, expect, it, vi } from "vitest";

import { renderToString } from "../../src/toolchain/server.ts";

/**
 * A fixture compiled by Qwik's plugin in this project. Imported by a computed path: the
 * fixtures are typed by the Qwik checker (typecheck.test.ts), not by this package's tsconfig.
 */
async function fixture(name: string): Promise<unknown> {
  const module: { default: unknown } = await import(`../fixtures/${name}.tsx`);
  return module.default;
}

const Attributes = await fixture("Attributes");
const Counter = await fixture("Counter");
const Greeting = await fixture("Greeting");

const LEVELS = ["log", "info", "warn", "error", "debug"] as const;

function spyOnConsole(): void {
  for (const level of LEVELS) vi.spyOn(console, level).mockImplementation(() => {});
}

function consoleCalls(): string[] {
  return LEVELS.flatMap((level) =>
    vi.mocked(console[level]).mock.calls.map((args) => `${level}: ${args.join(" ")}`),
  );
}

describe("the Qwik server renderer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns only the component's HTML, with props", async () => {
    spyOnConsole();
    const html = await renderToString(Greeting, { props: { name: "Unframework" } });
    // Qwik's own `:` attribute stays: normalisation, not the renderer, removes framework noise.
    expect(html).toMatch(/^<p [^>]*class="greeting"[^>]*>Hello, Unframework!<\/p>$/);
    expect(html).not.toContain("uf-qwik-container");
    expect(consoleCalls()).toEqual([]);
  });

  it("uses the component's defaults without props", async () => {
    expect(await renderToString(Greeting, {})).toMatch(/>Hello, world!<\/p>$/);
  });

  it("drops the container data an interactive component adds", async () => {
    spyOnConsole();
    const html = await renderToString(Counter, {});
    expect(html).toMatch(/^<div [^>]*class="counter"[^>]*>.*<\/div>$/s);
    expect(html).toContain("<output");
    expect(html).toMatch(/<button [^>]*q-e:click="[^"]+"/);
    expect(html).not.toContain("<script");
    expect(consoleCalls()).toEqual([]);
  });

  it("renders the same HTML twice: the random container instance never reaches it", async () => {
    for (const component of [Greeting, Counter, Attributes]) {
      const first = await renderToString(component, {});
      expect(await renderToString(component, {})).toBe(first);
    }
  });

  it("writes Qwik's attribute spellings, which an HTML parser reads as the HTML names", async () => {
    const html = await renderToString(Attributes, {});
    // HTML attribute names are case-insensitive; normalisation parses this HTML.
    expect(html).toMatch(/<label [^>]*accessKey="n"/);
    expect(html).toMatch(/<time [^>]*dateTime="2026-10-01"[^>]*itemProp="date"/);
    expect(html).toMatch(/<p [^>]*contentEditable="true"/);
    // An attribute written without a value renders empty, and a boolean one bare.
    expect(html).toMatch(/<input [^>]*data-state=""/);
    expect(html).toMatch(/<input [^>]*readOnly[\s>]/);
    expect(html).toMatch(/<button [^>]*formNoValidate[^>]*disabled[\s>]/);
    // SVG keeps its case-sensitive names.
    expect(html).toMatch(/<svg [^>]*viewBox="0 0 1 1"/);
  });
});
