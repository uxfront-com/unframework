// The report fixtures and the browser command that renders one, as both sides of the browser
// tests see them: `report-fixture.ts` implements the command in Node.

/** The fixture runs: one failed cell on seven targets, and cells that left fewer files. */
export const REPORT_FIXTURES = ["report-failed", "report-missing"] as const;
export type ReportFixture = (typeof REPORT_FIXTURES)[number];

declare module "vitest/browser" {
  interface BrowserCommands {
    /** Writes a fixture's `report.html` to `.output/<name>/`, and returns it and that directory. */
    ufReportFixture(name: ReportFixture): Promise<{ html: string; base: string }>;
  }
}
