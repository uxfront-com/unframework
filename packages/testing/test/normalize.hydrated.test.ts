// Rule 4f (ADR-0095): in a hydrated tree only, the markup of a bound control's first state goes
// wherever its live `uf:*` state is serialised. Outside a hydrate project the markup stays, as
// rule 4d leaves a value the person changed, and the live state still compares either way.
import { describe, expect, it } from "vitest";

import { normalizeHtml } from "../src/normalize/index.ts";
import { removeServerControlStates } from "../src/normalize/rules/control-values.ts";
import { NORMALIZE_TARGETS } from "../src/normalize/targets.ts";

/** A server's first state, kept by hydration, after the person changed each control. */
const HYDRATED = [
  '<input value="Ada" uf:value="Linus">',
  '<input type="checkbox" checked uf:checked="false">',
  '<select><option value="s" selected uf:selected="false">S</option><option value="m" uf:selected="true">M</option></select>',
  '<textarea uf:value="Buy milk and bread">Buy milk</textarea>',
].join("");

describe("rule 4f: removeServerControlStates", () => {
  it.each(NORMALIZE_TARGETS)(
    "keeps the first-state markup outside a hydrate project (%s)",
    (target) => {
      const html = normalizeHtml(HYDRATED, { target });
      expect(html).toContain('value="Ada"');
      expect(html).toContain('"Buy milk"');
      // React's rule 4e drops a box's and an option's first state everywhere (ADR-0060).
      if (target !== "react") {
        expect(html).toMatch(/\schecked=""/);
        expect(html).toMatch(/\sselected=""/);
      }
    },
  );

  it.each(NORMALIZE_TARGETS)("removes it in a hydrated tree (%s)", (target) => {
    const html = normalizeHtml(HYDRATED, { target, hydrated: true });
    expect(html).not.toContain('value="Ada"');
    expect(html).not.toMatch(/\schecked=""/);
    expect(html).not.toMatch(/\sselected=""/);
    expect(html).not.toContain('"Buy milk"');
    // The live state is all that is left to compare.
    expect(html).toContain('uf:value="Linus"');
    expect(html).toContain('uf:checked="false"');
    expect(html).toContain('uf:value="Buy milk and bread"');
  });

  it("still tells a live state that differs apart", () => {
    const hydrated = normalizeHtml('<input value="Ada" uf:value="Ada">', { hydrated: true });
    const client = normalizeHtml('<input uf:value="Linus">', { hydrated: true });
    expect(hydrated).not.toBe(client);
  });

  it("leaves a control without live state alone (a server render)", () => {
    expect(normalizeHtml('<input value="Ada">', { hydrated: true })).toBe(
      normalizeHtml('<input value="Ada">'),
    );
  });

  it("does nothing unless the tree is hydrated", () => {
    expect(removeServerControlStates.length).toBe(2);
    expect(() => normalizeHtml("<p>x</p>", { hydrated: "yes" as never })).toThrow(
      /hydrated is a boolean/,
    );
  });
});
