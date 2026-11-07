// The rules of a Playwright run, in a plain module, so a Vitest unit test reads what the config obeys
// (`harness/playwright-config.unit.test.ts`) without loading `@playwright/test`.

/** How many workers a run opens by default: CI's three. */
export const DEFAULT_WORKERS = 3;

/**
 * What every run obeys. No retries: a flaky test is a bug (AGENTS.md). No screenshot options: L10
 * compares through `ufVisualCapture` at zero tolerance, unless a case names a reason (ADR-0013).
 * Every spec file's one test may run beside another, though the driver declares them in one file.
 * No limit on that test: a spec file's tests are limited in the page, and a page that stops
 * answering by the driver.
 */
export const PLAYWRIGHT_RULES = {
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  timeout: 0,
} as const;

/** What the page host reads in place of Vitest's project config (`harness/projects.ts`). */
export const PAGE_RULES = {
  /** A locator that never matches fails in seconds, not at the test timeout (ADR-0043). */
  pollTimeout: 5_000,
  testTimeout: 60_000,
  /** Vitest's default in a browser project. */
  hookTimeout: 30_000,
  /** A test without an assertion fails L8: every spec asserts what it rendered (ADR-0043). */
  requireAssertions: true,
} as const;

/** The workers a run opens: `UF_WORKERS`, or {@link DEFAULT_WORKERS}. */
export function workersOf(env: Readonly<Record<string, string | undefined>>): number {
  const value = env.UF_WORKERS?.trim();
  if (!value) return DEFAULT_WORKERS;
  const workers = Number(value);
  if (!Number.isInteger(workers) || workers < 1) {
    throw new Error(`[uf] UF_WORKERS must be a whole number above 0, not "${value}".`);
  }
  return workers;
}

/** The Playwright project of a target: the Vitest project's name, so a matrix keeps its keys. */
export function browserProjectName(target: string): string {
  return `browser:${target}`;
}
