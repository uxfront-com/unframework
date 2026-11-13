// Runtime hygiene (L13): every console.warn and console.error is captured, in the page and from
// adapters that render elsewhere (Astro's server render), from the moment the setup file loads.
// The setup file judges them after each test and fails it on any message that is not
// allowlisted with a reason. Nothing is discarded: a message logged outside a test (while the
// modules evaluate, in a beforeAll hook, or after the previous test's teardown) is judged with
// the next test, and one logged after the last test is recorded on the file, which fails. Spec
// files may share a page (ADR-0092): a message logged after a file's last judgement, before the
// next file's setup runs, is judged with the next file's first test, and names the file it
// followed.

/** A captured console message. */
export interface ConsoleEntry {
  level: "warn" | "error";
  message: string;
  /** Where it was logged: the page, or the adapter's server-side render. */
  source: "page" | "server";
  /** It was logged before the test that judges it began. */
  beforeTest?: true;
  /** Why it is not judged: a step that fails on purpose logged it (ADR-0078). */
  excused?: string;
  /** The case of the spec file that had ended on this page when it was logged (ADR-0092). */
  afterFile?: string;
}

interface Allowance {
  pattern: RegExp;
  reason: string;
}

const entries: ConsoleEntry[] = [];
const allowances: Allowance[] = [];
let installed = false;
let errorWatcher: ((value: unknown) => void) | undefined;
let endedFile: string | undefined;

/** A captured message, with the spec file it followed if it came between two files. */
function capture(entry: ConsoleEntry): void {
  entries.push(endedFile === undefined ? entry : { ...entry, afterFile: endedFile });
}

/**
 * Wraps console.warn and console.error once per page. The originals still print, so the run log
 * keeps the messages.
 */
export function installConsoleCapture(): void {
  if (installed) return;
  installed = true;
  for (const level of ["warn", "error"] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      capture({ level, message: formatConsoleArgs(args), source: "page" });
      for (const arg of args) errorWatcher?.(arg);
      original(...args);
    };
  }
}

/** Records messages an adapter captured outside the page. */
export function captureExternalConsole(
  messages: readonly { level: "warn" | "error"; message: string }[],
): void {
  for (const { level, message } of messages) capture({ level, message, source: "server" });
}

/**
 * Allows console messages matching `pattern` in the current test. A reason is required: it is
 * the only record of why the message is acceptable.
 */
export function allowConsole(pattern: RegExp, reason: string): void {
  if (!reason.trim()) throw new Error("allowConsole needs a reason.");
  // Without `g` and `y`: their `test()` carries `lastIndex` from one message to the next, so a
  // second matching message would not match.
  allowances.push({
    pattern: new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, "")),
    reason,
  });
}

/**
 * Starts a test: the messages captured since the last judgement were logged outside any test,
 * and are judged with this one. The previous test's allowances end here.
 */
export function beginTestConsole(): void {
  for (const entry of entries) entry.beforeTest = true;
  allowances.length = 0;
}

/** Ends a judgement: the messages captured so far have been judged. */
export function endTestConsole(): void {
  entries.length = 0;
}

/**
 * Ends a spec file, whose case is `caseId`: what the page logs from now on, until the next spec
 * file starts, came after it.
 */
export function endSpecFileConsole(caseId: string): void {
  endedFile = caseId;
}

/** Starts a spec file: what the page logs from now on is this file's. */
export function beginSpecFileConsole(): void {
  endedFile = undefined;
}

/** Calls `watch` with each argument the console is given, until the returned function runs. */
export function watchConsoleErrors(watch: (value: unknown) => void): () => void {
  errorWatcher = watch;
  return () => {
    errorWatcher = undefined;
  };
}

/** Where the captured messages end now, for {@link excuseConsoleSince}. */
export function consoleMark(): number {
  return entries.length;
}

/**
 * Excuses the messages captured since `mark`, for one step that fails on purpose. A pattern
 * would not do: each framework reports the same throw in its own words, and an allowance by
 * pattern would hold for the rest of the test.
 */
export function excuseConsoleSince(mark: number, reason: string): void {
  if (!reason.trim()) throw new Error("excuseConsoleSince needs a reason.");
  for (const entry of entries.slice(mark)) entry.excused = reason;
}

/** Every message the current test will be judged on, those logged before it began first. */
export function capturedConsole(): readonly ConsoleEntry[] {
  return entries;
}

/** The captured messages no allowance covers. */
export function unexpectedConsole(): ConsoleEntry[] {
  return entries.filter(
    (entry) =>
      entry.excused === undefined && !allowances.some(({ pattern }) => pattern.test(entry.message)),
  );
}

/** Describes unexpected messages for a failure: one line each, the first line of the message. */
export function describeConsole(unexpected: readonly ConsoleEntry[]): string {
  const lines = unexpected.map((entry) => {
    const where = [
      ...(entry.source === "server" ? ["server render"] : []),
      ...(entry.beforeTest
        ? ["before the test: module evaluation, a beforeAll hook or an earlier teardown"]
        : []),
      ...(entry.afterFile === undefined
        ? []
        : [`after the last test of ${entry.afterFile}, which ran earlier on this page`]),
    ];
    return `  console.${entry.level}${where.length ? ` (${where.join("; ")})` : ""}: ${entry.message.split("\n")[0]}`;
  });
  return `${unexpected.length} unexpected console message(s):\n${lines.join("\n")}`;
}

/**
 * Formats console arguments as the console prints them, including printf-style substitutions,
 * which React uses (`console.error("…%s", name)`), so allowlist patterns match the real text.
 */
export function formatConsoleArgs(args: readonly unknown[]): string {
  const text = (value: unknown) =>
    value instanceof Error
      ? value.message
      : typeof value === "string"
        ? value
        : typeof value === "object" && value !== null
          ? safeJson(value)
          : String(value);
  const [first, ...rest] = args;
  if (typeof first !== "string") return args.map(text).join(" ");
  let index = 0;
  const head = first.replace(/%[sdifoOc%]/g, (token) => {
    if (token === "%%") return "%";
    if (token === "%c") {
      index += 1;
      return "";
    }
    return index < rest.length ? text(rest[index++]) : token;
  });
  return [head, ...rest.slice(index).map(text)].join(" ");
}

function safeJson(value: object): string {
  try {
    // JSON.stringify has no text for some objects (a function's own properties, for one).
    return JSON.stringify(value) ?? Object.prototype.toString.call(value);
  } catch {
    // Circular structures (DOM nodes, framework internals) have no JSON form; their tag is enough.
    return Object.prototype.toString.call(value);
  }
}
