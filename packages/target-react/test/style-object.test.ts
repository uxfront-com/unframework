// The `styleObject` helper (ADR-0065), run as the output declares it: a declaration list's
// property names read as the browser reads them, case-insensitive, so `COLOR` applies and a
// camel-case name, which CSS doesn't know, doesn't.
import { stripTypeScriptTypes } from "node:module";

import { describe, expect, it } from "vitest";

import { styleObjectHelper } from "../src/dialect.ts";

/** The helper's code, its types stripped, loaded as a module. */
async function loadHelper(): Promise<(style: unknown) => Record<string, string> | undefined> {
  const code = `${stripTypeScriptTypes(styleObjectHelper("styleObject", "CSSProperties"))}
export { styleObject };`;
  const loaded: { styleObject: (style: unknown) => Record<string, string> | undefined } =
    await import(`data:text/javascript,${encodeURIComponent(code)}`);
  return loaded.styleObject;
}

describe("styleObject", () => {
  it("reads a declaration list's names case-insensitively, as the browser does", async () => {
    const styleObject = await loadHelper();
    // `margintop` is no CSS property, as `marginTop` is none in a declaration list.
    expect(styleObject("marginTop: 4px; COLOR: red; Margin-Left: 2px")).toEqual({
      margintop: "4px",
      color: "red",
      marginLeft: "2px",
    });
  });

  it("keeps a custom property's case, and its digit-led name", async () => {
    const styleObject = await loadHelper();
    expect(styleObject("--Gap: 4px; --2x: 1px")).toEqual({ "--Gap": "4px", "--2x": "1px" });
  });

  it("passes an object through", async () => {
    const styleObject = await loadHelper();
    const look = { color: "red" };
    expect(styleObject(look)).toBe(look);
    expect(styleObject(undefined)).toBeUndefined();
  });
});
