// The diagnostics reference (apps/web/content/docs/3.reference/2.diagnostics.md) holds one
// section per catalogued code, with the entry's name, severity, title and description as the
// catalogue words them: `docsUrl()` sends every diagnostic there, so the page must not drift.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { BANDS, catalogue } from "@unframework/diagnostics";
import { describe, expect, it } from "vitest";

import { root } from "./workspace.ts";

const page = readFileSync(join(root, "apps/web/content/docs/3.reference/2.diagnostics.md"), "utf8");

/** The page's sections in order: the band (`## …`) and each code's section (`### …`) in it. */
function sections() {
  const found: { band: string; code: string; text: string }[] = [];
  let band = "";
  for (const part of page.split(/^(?=##+ )/m)) {
    const heading = /^(##+) (.*)\n/.exec(part);
    if (!heading) continue;
    if (heading[1] === "##") band = heading[2]!;
    const code = /^### \[(UF\d{4})\]\{#\1\} /.exec(part)?.[1];
    // A copied code block carries `<!-- prettier-ignore -->`, which keeps oxfmt off its code.
    const text = part.replaceAll("<!-- prettier-ignore -->\n", "").trimEnd();
    if (code) found.push({ band, code, text });
  }
  return found;
}

describe("the diagnostics reference page", () => {
  it("has a section for every catalogued code, in order, under its band", () => {
    const found = sections();
    expect(found.map(({ code }) => code)).toEqual([...catalogue.keys()]);
    for (const { band, code } of found) expect(band).toBe(BANDS[code.slice(0, 3)]);
  });

  it("words each section as the catalogue does", () => {
    for (const { code, text } of sections()) {
      const entry = catalogue.get(code as never)!;
      const severity = entry.severity[0]!.toUpperCase() + entry.severity.slice(1);
      expect(text).toBe(
        `### [${code}]{#${code}} ${entry.name}\n\n` +
          `**${severity}.** ${entry.title}.\n\n` +
          entry.description.trimEnd(),
      );
    }
  });
});
