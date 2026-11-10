import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { COLOR_SCHEME_WAIT_MS, checkEnvironment } from "../src/browser/determinism.ts";

/**
 * A page whose media queries match the deterministic context, but for the overrides, and whose
 * dark colour scheme applies `darkAfter` milliseconds after the check starts (never, when
 * `Infinity`). It counts each query's reads.
 */
function stubPage(darkAfter: number, overrides: Record<string, boolean> = {}) {
  const start = Date.now();
  const reads = new Map<string, number>();
  vi.stubGlobal("window", { devicePixelRatio: 1 });
  vi.stubGlobal("matchMedia", (query: string) => {
    reads.set(query, (reads.get(query) ?? 0) + 1);
    const scheme = Date.now() - start >= darkAfter ? "dark" : "light";
    const matches =
      overrides[query] ??
      (query === "(prefers-reduced-motion: reduce)" ||
        query === "(forced-colors: none)" ||
        query === `(prefers-color-scheme: ${scheme})`);
    return { matches };
  });
  return reads;
}

const MESSAGE =
  "Visual determinism: the browser context does not satisfy prefers-color-scheme: dark. The project must set the provider's contextOptions (see the screenshot ADR), and the setup file emulate the case's colour scheme (ADR-0061).";

describe("checkEnvironment", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("passes at once when the scheme already applies", async () => {
    const reads = stubPage(0);
    await expect(checkEnvironment("dark")).resolves.toBeUndefined();
    expect(reads.get("(prefers-color-scheme: dark)")).toBe(1);
  });

  // Firefox: the emulation reaches the tester frame after the command that set it returns.
  it("waits for a colour scheme that applies late", async () => {
    stubPage(1200);
    const check = checkEnvironment("dark");
    let settled = false;
    void check.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(1100);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(200);
    await expect(check).resolves.toBeUndefined();
  });

  it("throws today's message once the scheme has not applied for the whole wait", async () => {
    stubPage(Infinity);
    const check = checkEnvironment("dark");
    const failure = expect(check).rejects.toThrow(MESSAGE);
    let settled = false;
    check.catch(() => {}).finally(() => (settled = true));
    await vi.advanceTimersByTimeAsync(COLOR_SCHEME_WAIT_MS - 100);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(200);
    await failure;
  });

  it("waits at most five seconds", () => {
    expect(COLOR_SCHEME_WAIT_MS).toBe(5000);
  });

  it("reads every other entry once, and names each one that fails", async () => {
    const reads = stubPage(Infinity, { "(prefers-reduced-motion: reduce)": false });
    await expect(checkEnvironment("light")).rejects.toThrow(
      "does not satisfy prefers-reduced-motion: reduce. ",
    );
    expect(reads.get("(prefers-reduced-motion: reduce)")).toBe(1);
    expect(reads.get("(forced-colors: none)")).toBe(1);
  });

  it("does not wait for a colour scheme the case does not ask for", async () => {
    // The page turns dark later, but a light case reads light at once.
    const reads = stubPage(1000);
    await expect(checkEnvironment("light")).resolves.toBeUndefined();
    expect(reads.get("(prefers-color-scheme: light)")).toBe(1);
  });
});
