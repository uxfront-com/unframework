// What a spec file's page leaves for the reporter, which runs in another process: each record is an
// attachment of the file's one Playwright test, so a worker that dies leaves what it had.
import { caseOfFile } from "../harness.ts";
import type { HarnessContext } from "../harness.ts";
import type {
  PageCollectedRecord,
  PageCollectedTest,
  PageError,
  PageFileRecord,
  PageTestRecord,
} from "../hosts/page/protocol.ts";

/** The attachment each record goes in. Its body is the record, as JSON. */
export const RECORD_ATTACHMENT = "uf-record";

/** Where an uncaught error was seen: the page host's listeners, or Playwright's `pageerror`. */
export type UncaughtSource = "page listener" | "pageerror";

/** An error or a rejection nothing caught, which fails the run whatever its cells say. */
export interface UncaughtError extends PageError {
  source: UncaughtSource;
  /** The test that ran when it happened. */
  test?: string;
}

/** A spec file's last record: the page's, and every uncaught error from either source. */
export interface DriverFileRecord extends Omit<PageFileRecord, "unhandled"> {
  uncaught: UncaughtError[];
}

/** What reaches the reporter. */
export type DriverRecord = PageCollectedRecord | PageTestRecord | DriverFileRecord;

/** The tests a page collected and never finished, each test with a record once. */
export function unfinishedTests(
  collected: readonly PageCollectedTest[],
  records: readonly Pick<PageTestRecord, "fullName">[],
): PageCollectedTest[] {
  const left = records.map(({ fullName }) => fullName);
  return collected.filter((test) => {
    const index = left.indexOf(test.fullName);
    if (index === -1) return true;
    left.splice(index, 1);
    return false;
  });
}

/**
 * The record of a test its page never finished: L8 fails with the reason, by the test's own name,
 * in the case's cell. The layers it never reached have nothing to say.
 */
export function unfinishedRecord(
  test: PageCollectedTest,
  context: { filepath: string; target: string; harness: HarnessContext; reason: string },
): PageTestRecord {
  const message = `"${test.fullName}" did not finish: ${context.reason}`;
  return {
    kind: "test",
    filepath: context.filepath,
    name: test.name,
    fullName: test.fullName,
    state: "fail",
    errors: [{ name: "Error", message }],
    meta: {
      uf: {
        case: caseOfFile(context.filepath, context.harness),
        target: context.target,
        layers: { L8: { status: "fail", message } },
      },
    },
  };
}
