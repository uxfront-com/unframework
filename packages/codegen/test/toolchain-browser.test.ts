import { describe, expect, it } from "vitest";

import { assertSerialisableProps } from "../src/toolchain-browser/index.ts";

describe("assertSerialisableProps", () => {
  it("accepts props that survive JSON", () => {
    expect(() =>
      assertSerialisableProps(
        {
          name: "Ada",
          count: 2,
          open: false,
          missing: undefined,
          none: null,
          items: [{ id: 1, tags: ["a"] }],
          bare: Object.create(null),
        },
        "Rendered on the server",
      ),
    ).not.toThrow();
  });

  it.each([
    ["onClick", () => undefined, "`onClick` is a function"],
    ["ratio", Number.NaN, "`ratio` is NaN"],
    ["when", new Date(0), "`when` is a Date instance"],
    ["nested", { list: [1, Symbol("s")] }, "`nested.list[1]` is a symbol"],
    ["big", 1n, "`big` is a bigint"],
  ])("rejects a prop JSON would change (%s)", (key, value, message) => {
    expect(() => assertSerialisableProps({ [key]: value }, "Rendered on the server")).toThrow(
      `Rendered on the server, so props must be JSON values; ${message}.`,
    );
  });
});
