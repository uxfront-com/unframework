// The targets reference (apps/web/content/docs/3.reference/1.targets.md) declares, in one table,
// how every target supports every capability (P4, ADR-0033): the support, and an emulated cell's
// helper. A difference between frameworks is declared there, so the page must say what the
// targets declare: the table is rendered from their cells and compared, as the diagnostics page
// is with the catalogue, and every cell that is not native has its note under the table.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { CAPABILITY_NAMES } from "@unframework/codegen";
import type { CapabilityCell } from "@unframework/codegen";
import { builtinTargets, TARGET_NAMES } from "@unframework/compiler";
import type { TargetName } from "@unframework/compiler";
import { describe, expect, it } from "vitest";

import { root } from "./workspace.ts";

const page = readFileSync(join(root, "apps/web/content/docs/3.reference/1.targets.md"), "utf8");

/** Each target by the name the page writes it with. */
const NAMES: Readonly<Record<TargetName, string>> = {
  react: "React",
  vue: "Vue",
  svelte: "Svelte",
  angular: "Angular",
  solid: "Solid",
  qwik: "Qwik",
  astro: "Astro",
};

/** A cell as the table writes it: `native`, `emulated` and its helper, or `unsupported`. */
function written(cell: CapabilityCell): string {
  return cell.support === "emulated" ? `emulated \`${cell.helper}\`` : cell.support;
}

/** The cells of a Markdown table row, trimmed. */
const cellsOf = (line: string) =>
  line
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());

/** The capability table: its header's cells, and each row's, by the row's capability. */
function capabilityTable(): { header: string[]; rows: string[][] } {
  const lines = page.split("\n");
  const start = lines.findIndex((line) => /^\| Capability +\|/.test(line));
  if (start < 0) throw new Error("The targets page has no capability table.");
  const header = cellsOf(lines[start]!);
  const rows: string[][] = [];
  for (const line of lines.slice(start + 2)) {
    if (!line.startsWith("|")) break;
    rows.push(cellsOf(line));
  }
  return { header, rows };
}

/** The notes under the table: each bullet's bold heading (`**Qwik, `late-prop`**`). */
function notes(): string[] {
  return [...page.matchAll(/^- \*\*([^*]+)\*\*/gm)].map((match) => match[1]!);
}

describe("the targets reference page", () => {
  it("has a row for every capability, in the matrix's order, and a column for every target", () => {
    const { header, rows } = capabilityTable();
    expect(header.slice(0, 2)).toEqual(["Capability", "What it covers"]);
    expect(header.slice(2).toSorted()).toEqual(TARGET_NAMES.map((name) => NAMES[name]).toSorted());
    expect(rows.map((row) => row[0])).toEqual(CAPABILITY_NAMES.map((name) => `\`${name}\``));
    for (const row of rows) expect(row[1], row[0]).not.toBe("");
  });

  it("writes each target's cell as the target declares it", () => {
    const { header, rows } = capabilityTable();
    const expected = rows.map((row, index) => [
      row[0],
      row[1],
      ...header.slice(2).map((column) => {
        const target = TARGET_NAMES.find((name) => NAMES[name] === column)!;
        return written(builtinTargets[target].capabilities[CAPABILITY_NAMES[index]!]);
      }),
    ]);
    expect(rows).toEqual(expected);
  });

  it("has a note under the table for every cell that is not native", () => {
    const headings = notes();
    const missing = TARGET_NAMES.flatMap((target) =>
      CAPABILITY_NAMES.filter(
        (capability) => builtinTargets[target].capabilities[capability].support !== "native",
      )
        .filter(
          (capability) =>
            !headings.some(
              (heading) =>
                heading.startsWith(`${NAMES[target]}, `) && heading.includes(`\`${capability}\``),
            ),
        )
        .map((capability) => `${NAMES[target]}, \`${capability}\``),
    );
    expect(missing).toEqual([]);
  });
});
