// What nothing catches in the page, which Vitest's own client holds under its browser mode
// (`vitest-dev/vitest@v5.0.3`, packages/browser/src/client/public/error-catcher.js): an error or a
// rejection with a value fails the run; one with none, such as a ResizeObserver message or a
// `Promise.reject()`, goes to the console, so L13 judges it. Vitest's count of the page's own
// listeners isn't copied: Storybook's permanent ones would stop it reporting on the real host only.
// An event with a value and a listener of the page's own therefore reports here, where Vitest's
// would log it, which no corpus spec can tell apart: none adds a listener for either event.
import { recordUnhandled, serializeError } from "./runner.ts";

/** Installs the two listeners, once per page. */
export function installErrorListeners(): void {
  listen("error", "error", "Error");
  listen("unhandledrejection", "reason", "Unhandled Rejection");
}

function listen(
  event: "error" | "unhandledrejection",
  property: "error" | "reason",
  type: "Error" | "Unhandled Rejection",
): void {
  window.addEventListener(event, (fired) => {
    const value = (fired as unknown as Record<string, unknown>)[property];
    if (value !== null && value !== undefined) {
      recordUnhandled({ type, ...serializeError(value) });
      return;
    }
    // An `ErrorEvent` may have only a message.
    const { message } = fired as ErrorEvent;
    console.error(message ? new Error(message) : fired);
  });
}
