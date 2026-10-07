// The QRLs the Qwik mount adapter passes for the test's listeners (browser). An event prop of a
// Qwik component is a QRL (`onChange$`), which a plain function is not, and a QRL built by hand
// renders an error host where a component's would (host.ts): this module is compiled by the
// optimizer, like the output under test, which extracts the `$()` below into a segment that
// captures the listener.
import { $, noSerialize } from "@qwik.dev/core";
import type { QRL } from "@qwik.dev/core";
import type { MountListener } from "@unframework/codegen";

/** A QRL that calls the test's listener with the arguments the component emits. */
export function listenerQrl(listener: MountListener): QRL<MountListener> {
  // The listener lives in the test's page only, and a client render never serialises it: Qwik's
  // development check refuses to capture a function unless it is marked so.
  const local = noSerialize(listener);
  return $((...args: unknown[]) => local?.(...args));
}
