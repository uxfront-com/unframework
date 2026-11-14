// The QRLs the Qwik mount adapter passes for the test's listeners (browser). An event prop of a
// Qwik component is a QRL (`onChange$`), which a plain function is not, and a QRL built by hand
// renders an error host where a component's would (host.qwik.ts): this module is compiled by the
// optimizer, like the output under test, which extracts the `$()` below into a segment that
// captures the listener.
import { $, noSerialize } from "@qwik.dev/core";
import type { QRL } from "@qwik.dev/core";
import type { MountListener } from "@unframework.dev/codegen";

/** A QRL that calls the test's listener with the arguments the component emits. */
export function listenerQrl(listener: MountListener): QRL<MountListener> {
  // The listener lives in the test's page only, and a client render never serialises it: Qwik's
  // development check refuses to capture a function unless it is marked so.
  const local = noSerialize(listener);
  return $((...args: unknown[]) => local?.(...args));
}

/** Where a resumed component's listeners find the test's (L12): resumed view, then event name. */
export const RESUMED_LISTENERS = "__ufQwikResumedListeners";

/**
 * A QRL the server renders for one of the test's listeners (L12, ADR-0095): a function never
 * crosses from the server to the page, so it captures the view and the event's names only, and
 * calls the listener the page registered under them.
 */
export function resumedListenerQrl(view: string, name: string): QRL<MountListener> {
  return $((...args: unknown[]) => {
    const registry = (globalThis as Record<string, unknown>)[RESUMED_LISTENERS] as
      | Record<string, Record<string, MountListener> | undefined>
      | undefined;
    registry?.[view]?.[name]?.(...args);
  });
}
