// The host port: everything the spec runtime needs from the runner around it. `view.ts`,
// `user.ts`, `parity.ts`, the setup file and the rest of this directory keep their logic and reach
// a runner only through here, so one spec text can run on more than one. The Vitest host
// (`../hosts/vitest/`) implements it, and a setup file loaded ahead of `../setup.ts` installs it.
import type { UfCommands, SerializedLocatorLike } from "../commands.ts";
import type { HarnessProvided } from "../harness.ts";
import type { LayerTask, UfLayerMeta } from "../layers.ts";
import type { CaptureAttachment } from "../visual-types.ts";

/** How a query matches its text. */
export interface LocatorOptions {
  exact?: boolean;
}

/** What `getByRole` narrows by, beside the role. */
export interface LocatorByRoleOptions extends LocatorOptions {
  checked?: boolean;
  disabled?: boolean;
  expanded?: boolean;
  includeHidden?: boolean;
  level?: number;
  name?: string | RegExp;
  pressed?: boolean;
  selected?: boolean;
}

/** What `filter` narrows a locator by. */
export interface LocatorFilterOptions {
  hasText?: string | RegExp;
  hasNotText?: string | RegExp;
  has?: Locator;
  hasNot?: Locator;
}

/** An element query that stays valid as the DOM changes: what a spec and a view hold. */
export interface Locator {
  readonly selector: string;
  readonly length: number;
  /** The form a command receives, whose `locator` string a trace step names its target by. */
  serialize(): SerializedLocatorLike;
  getByRole(role: string, options?: LocatorByRoleOptions): Locator;
  getByLabelText(text: string | RegExp, options?: LocatorOptions): Locator;
  getByAltText(text: string | RegExp, options?: LocatorOptions): Locator;
  getByPlaceholder(text: string | RegExp, options?: LocatorOptions): Locator;
  getByText(text: string | RegExp, options?: LocatorOptions): Locator;
  getByTitle(text: string | RegExp, options?: LocatorOptions): Locator;
  getByTestId(text: string | RegExp): Locator;
  element(): HTMLElement | SVGElement;
  elements(): (HTMLElement | SVGElement)[];
  query(): HTMLElement | SVGElement | null;
  all(): Locator[];
  nth(index: number): Locator;
  first(): Locator;
  last(): Locator;
  and(locator: Locator): Locator;
  or(locator: Locator): Locator;
  filter(options: LocatorFilterOptions): Locator;
}

/** The file a test belongs to, which a layer may be recorded on as a test's is. */
export interface HostFile extends LayerTask {
  filepath: string;
}

/** One error of a test, serialised by its runner. */
export interface HostTestError {
  name?: string;
  message: string;
}

/** A test as its runner holds it: what the runtime reads and records on it. */
export interface HostTest extends LayerTask {
  meta: {
    uf?: UfLayerMeta;
    /** The capabilities the test requires (`it(name, { requires }, fn)`). */
    ufRequires?: readonly string[];
  };
  file: HostFile;
  /** Absent until the test runs. The setup's judge writes both fields of a quarantined test. */
  result?: { state: string; errors?: HostTestError[] };
}

/** What a test function is called with. */
export interface HostTestContext {
  task: HostTest;
}

/** A test's body. */
export type HostTestFunction = (context: HostTestContext) => unknown;

/** What a runner takes beside a test's name and body. */
export interface HostTestOptions {
  timeout?: number;
  meta?: Readonly<Record<string, unknown>>;
}

/** The hooks the setup file registers, around every test of a spec file. */
export interface HostHooks {
  beforeAll(fn: (file: HostFile) => Promise<void>): void;
  afterAll(fn: (file: HostFile) => Promise<void>): void;
  /** Runs before a test. `skip` ends it there, with the reason. */
  beforeEach(fn: (test: HostTest, skip: (reason: string) => never) => void): void;
  afterEach(fn: (test: HostTest) => Promise<void>): void;
  /** Wraps a test and its other hooks: it runs even when a spec's own afterEach throws. */
  aroundEach(fn: (run: () => Promise<void>, test: HostTest) => Promise<void>): void;
}

/** The assertions the runtime makes itself, and the `expect.element` it bounds. */
export interface HostExpect {
  (actual: unknown, message?: string): { toEqual(expected: unknown): void };
  stringMatching: (expected: RegExp) => unknown;
  element: (
    subject: HTMLElement | SVGElement | Locator | null,
    options?: { timeout?: number },
  ) => unknown;
}

/** The input a command does not dispatch: the actions Playwright runs as one. */
export interface HostUserEvent {
  unhover(target: Locator): Promise<void>;
  fill(target: Locator, text: string): Promise<void>;
  clear(target: Locator): Promise<void>;
  selectOptions(target: Locator, values: string[]): Promise<void>;
  /** Lets go of what the runner's own input state holds, between tests. */
  cleanup(): Promise<void>;
}

/** The page's fake `setInterval` and `clearInterval` (`./clock.ts`). */
export interface HostClock {
  /** Fakes both, keeping the fake clock as `setInterval.clock`. */
  install(): void;
  restore(): void;
}

/** A failed visual comparison's images, for the runner's reporters to show. */
export interface HostVisualFailure {
  message: string;
  attachments: CaptureAttachment[];
}

/** What a runner gives the spec runtime. */
export interface Host {
  /** The Node commands the page calls. */
  commands: UfCommands;
  /** The page's own queries. */
  page: { getByTestId(text: string | RegExp): Locator };
  expect: HostExpect;
  userEvent: HostUserEvent;
  clock: HostClock;
  hooks: HostHooks;
  /** The test running now, or nothing between tests. */
  currentTest: () => HostTest | undefined;
  /** The run's values from Node. A value the project does not provide reads `undefined`. */
  inject: <K extends keyof HarnessProvided>(key: K) => HarnessProvided[K];
  /** How long `expect.element` waits by default, or nothing when the project sets no bound. */
  pollTimeout: () => number | undefined;
  recordVisualFailure: (test: HostTest, failure: HostVisualFailure) => Promise<void>;
  describe: (name: string, fn: () => void) => void;
  it: (name: string, options: HostTestOptions, fn: HostTestFunction) => void;
}

let installed: Host | undefined;

/** Installs the project's host, for every module of this spec file's page to reach. */
export function installHost(next: Host): void {
  installed = next;
}

/** The project's host. */
export function host(): Host {
  if (!installed) {
    throw new Error(
      "No test host is installed: the project's setupFiles must start with @unframework/testing/hosts/vitest, ahead of @unframework/testing/setup.",
    );
  }
  return installed;
}
