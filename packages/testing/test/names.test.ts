import { describe, expect, it } from "vitest";

import { KEBAB_CASE } from "../src/node/names.ts";

describe("KEBAB_CASE", () => {
  it("accepts words of a-z and 0-9 joined by single hyphens", () => {
    for (const name of ["a", "1", "a-1", "initial", "after-click", "x2-y3-z4"]) {
      expect(KEBAB_CASE.test(name), name).toBe(true);
    }
  });

  it("refuses empty words, other characters and anything but lower case", () => {
    for (const name of [
      "",
      "after--click",
      "open-",
      "-open",
      "-",
      "Initial",
      "after_click",
      "after.click",
      "after click",
      "a/b",
      "café",
      "initial\n",
    ]) {
      expect(KEBAB_CASE.test(name), JSON.stringify(name)).toBe(false);
    }
  });
});
