// What nothing caught in a page, from both places that see it. The page host's listeners see each
// event with its value and report it (`../hosts/page/errors.ts`). Playwright's `pageerror` sees
// what those can't, such as an error before they are installed or in another frame. The engines
// also report there what the listeners caught, and what they sent to the console for having no
// value, which L13 judges and which fails no run on its own (a `Promise.reject()` reads `undefined`,
// and WebKit reports a ResizeObserver message).
import type { PageError, PageUnhandledRecord } from "../hosts/page/protocol.ts";
import type { UncaughtError } from "./records.ts";

/** What each source saw of one spec file. */
export interface SeenErrors {
  /** The page host's listeners' records. */
  listener: readonly PageUnhandledRecord[];
  /** Playwright's `pageerror` events. */
  pageErrors: readonly PageError[];
  /** The messages of the events without a value, which the listeners sent to the console. */
  logged: readonly string[];
}

/** Every error the listeners saw, then each `pageerror` they don't account for. */
export function uncaughtErrors({ listener, pageErrors, logged }: SeenErrors): UncaughtError[] {
  const heard = [...listener.map(({ message }) => message), ...logged];
  // WebKit words a rejection's error with its name in front.
  const accounted = ({ message }: PageError) =>
    heard.some((text) => message === text || message.endsWith(`: ${text}`));
  return [
    ...listener.map(({ name, message, stack, test }): UncaughtError => ({
      source: "page listener",
      message,
      ...(name === undefined ? {} : { name }),
      ...(stack === undefined ? {} : { stack }),
      ...(test === undefined ? {} : { test }),
    })),
    ...pageErrors
      .filter((error) => !accounted(error))
      .map(({ name, message, stack }): UncaughtError => ({
        source: "pageerror",
        message,
        ...(name === undefined ? {} : { name }),
        ...(stack === undefined ? {} : { stack }),
      })),
  ];
}
