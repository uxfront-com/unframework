// The bound on `expect.element` (element-timeout.ts) wraps Vitest's matcher once per page, though
// the setup file that installs it runs again for every spec file that shares the page (ADR-0092).
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("vitest/browser", () => ({
  server: { config: { expect: { poll: { timeout: 5_000 } } } },
}));

const { boundElementTimeout } = await import("../src/browser/element-timeout.ts");

const original = expect.element;

describe("boundElementTimeout", () => {
  afterEach(() => {
    expect.element = original;
  });

  it("wraps expect.element once, however often the setup file runs", () => {
    const element = vi.fn<typeof expect.element>();
    expect.element = element;
    boundElementTimeout();
    const bound = expect.element;
    expect(bound).not.toBe(element);
    boundElementTimeout();
    expect(expect.element).toBe(bound);
    void bound(null);
    expect(element).toHaveBeenCalledTimes(1);
    expect(element).toHaveBeenCalledWith(null, { timeout: 5_000 });
  });
});
