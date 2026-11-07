// What the page host and the Node side that drives it agree on: the config the driver hands the
// page, the one binding its commands go through, and the events the page reports. Types and
// names only, so it loads on both sides.
import type { HarnessProvided } from "../../harness.ts";
import type { UfLayerMeta } from "../../layers.ts";
import type { CaptureAttachment } from "../../visual-types.ts";

/** The global an init script sets to the {@link PageHostConfig}, before the page's modules load. */
export const PAGE_CONFIG = "__ufPageHostConfig";

/** The binding a command goes through: `(name, args)`, answering a {@link PageCallResult}. */
export const PAGE_CALL = "__ufPageHostCall";

/** The binding the page reports a {@link PageEvent} through. */
export const PAGE_REPORT = "__ufPageHostReport";

/** What the page reads from Node, in place of Vitest's project config and `test.provide`. */
export interface PageHostConfig {
  /** `inject`'s values. */
  provided: HarnessProvided;
  /** How long `expect.element` waits by default (Vitest's `expect.poll.timeout`). */
  pollTimeout: number;
  /** How long a test may run, unless its options name another. */
  testTimeout: number;
  /** How long a hook may run. */
  hookTimeout: number;
  /** Whether a test without an assertion fails (Vitest's `expect.requireAssertions`). */
  requireAssertions: boolean;
}

/** One error, as a runner records it. */
export interface PageError {
  name?: string;
  message: string;
  stack?: string;
}

/** A command's answer. A thrown error crosses as data, since a binding's rejection loses its name. */
export type PageCallResult = { ok: true; value: unknown } | { ok: false; error: PageError };

/** The actions Playwright runs as one, which Vitest's `userEvent` runs through its provider. */
export type PageActionName = "ufUnhover" | "ufFill" | "ufClear" | "ufSelectOptions";

/** A test's record, when it has finished. */
export interface PageTestRecord {
  kind: "test";
  filepath: string;
  name: string;
  /** Its suites' names and its own, joined as Vitest's `fullName` is. */
  fullName: string;
  state: "pass" | "fail" | "skip";
  /** A skip's reason. */
  note?: string;
  errors?: PageError[];
  meta: { uf?: UfLayerMeta };
  /** What a failed visual comparison left, for a reporter to show. */
  artifacts?: { message: string; attachments: CaptureAttachment[] }[];
}

/** An error or a rejection nothing caught, with what ran when it happened. */
export interface PageUnhandledRecord extends PageError {
  kind: "unhandled";
  type: "Error" | "Unhandled Rejection";
  filepath?: string;
  test?: string;
}

/** A spec file's record, once its tests and hooks have finished. */
export interface PageFileRecord {
  kind: "file";
  filepath: string;
  state: "pass" | "fail";
  errors?: PageError[];
  meta: { uf?: UfLayerMeta };
  /** What nothing caught while the file ran: it fails the run, whatever the tests say. */
  unhandled: PageUnhandledRecord[];
}

/** What the page reports, as it happens. */
export type PageEvent = PageTestRecord | PageUnhandledRecord | PageFileRecord;
