// The report fixtures, rendered as a run would: `test/fixtures/<name>/` holds a `report.json` and
// the images it names, and `.output/<name>/` gets a copy of both with `report.html` beside them,
// which stays on disk, so the page can be opened from `file://` after the tests.
import { cpSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { BrowserCommand } from "vitest/node";

import { renderReport } from "../src/report-page.ts";
import type { VisualReport } from "../src/report.ts";
import { REPORT_FIXTURES } from "./report-commands.ts";
import type { ReportFixture } from "./report-commands.ts";

const PACKAGE = fileURLToPath(new URL("..", import.meta.url));

/** The output directory of a fixture, relative to the package (and to its Vite server's root). */
export function fixtureOutput(name: ReportFixture): string {
  return `.output/${name}`;
}

/** Copies a fixture to `.output/<name>/` and writes its page: the report and the HTML. */
export function writeReportFixture(name: ReportFixture): { report: VisualReport; html: string } {
  if (!REPORT_FIXTURES.includes(name)) throw new Error(`No report fixture named ${String(name)}.`);
  const out = join(PACKAGE, fixtureOutput(name));
  rmSync(out, { recursive: true, force: true });
  cpSync(join(PACKAGE, "test/fixtures", name), out, { recursive: true });
  const report = JSON.parse(readFileSync(join(out, "report.json"), "utf8")) as VisualReport;
  const html = renderReport(report);
  writeFileSync(join(out, "report.html"), html);
  return { report, html };
}

/** `ufReportFixture`: the browser test's way to the page, which only Node can write. */
export const ufReportFixture: BrowserCommand<[name: ReportFixture]> = (_context, name) => ({
  html: writeReportFixture(name).html,
  base: `/${fixtureOutput(name)}/`,
});
