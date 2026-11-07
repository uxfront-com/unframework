// The test running now. Apart from the runner, since `expect` reads it and the runner calls `expect`.
import type { HostFile, HostTest } from "../../browser/host.ts";
import type { PageFileRecord, PageTestRecord } from "./protocol.ts";

/** A test as the page host's runner holds it. */
export interface PageTest extends HostTest {
  name: string;
  fullName: string;
  suite: { name: string };
  /** Checks to run when the test has finished: an assertion nobody awaited fails it. */
  onFinished?: (() => void)[];
  artifacts?: PageTestRecord["artifacts"];
}

/** The spec file a page runs: one per page. */
export interface PageFile extends HostFile {
  name: string;
  result?: Pick<PageFileRecord, "state" | "errors">;
}

let current: PageTest | undefined;

/** The test running now, or nothing between tests. */
export function currentPageTest(): PageTest | undefined {
  return current;
}

/** Sets the test running now. */
export function setCurrentPageTest(test: PageTest | undefined): void {
  current = test;
}
