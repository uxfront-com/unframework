// The page host: the host port (`../../browser/host.ts`) on published packages alone, with no
// Vitest in the page. `./setup.ts` installs it. The driver hands it its values (`./protocol.ts`),
// and answers its commands through one binding, so real input, ARIA and captures stay in Node.
import { withGlobal } from "@sinonjs/fake-timers";

import type { Host, HostExpect, Locator } from "../../browser/host.ts";
import type { UfCommands } from "../../commands.ts";
import { callNode, pageConfig } from "./config.ts";
import { expect } from "./expect.ts";
import { getByTestId } from "./locators.ts";
import type { PageActionName } from "./protocol.ts";
import { describe, hooks, it } from "./runner.ts";
import { currentPageTest } from "./state.ts";
import type { PageTest } from "./state.ts";

const commands = new Proxy({} as UfCommands, {
  get:
    (_, name) =>
    (...args: unknown[]) =>
      callNode(String(name), args),
});

/** An action Node runs, whose only answer is that it finished. */
async function action(name: PageActionName, ...args: unknown[]): Promise<void> {
  await callNode(name, args);
}

let clock: ReturnType<ReturnType<typeof withGlobal>["install"]> | undefined;

/** The host a page without Vitest runs its specs with. */
export const pageHost: Host = {
  commands,
  page: { getByTestId: (text) => getByTestId(text) as unknown as Locator },
  expect: expect as unknown as HostExpect,
  userEvent: {
    // Vitest's `unhover` moves the mouse onto the body, whatever it was given.
    unhover: () => action("ufUnhover"),
    fill: (target, text) => action("ufFill", target.serialize(), text),
    clear: (target) => action("ufClear", target.serialize()),
    selectOptions: (target, values) => action("ufSelectOptions", target.serialize(), values),
    // Vitest's lets go of the keys its own `keyboard` and `type` hold, which `view.user` never
    // calls: it holds keys through `ufInput`, and the setup releases those (`releaseKeys`).
    cleanup: () => Promise.resolve(),
  },
  clock: {
    install() {
      clock = withGlobal(globalThis).install({
        now: Date.now(),
        toFake: ["setInterval", "clearInterval"],
        // A native interval started before the clock and cleared while it runs reaches the native
        // `clearInterval`, rather than a warning L13 would catch.
        shouldClearNativeTimers: true,
        ignoreMissingTimers: true,
      });
    },
    restore() {
      clock?.uninstall();
      clock = undefined;
    },
  },
  hooks,
  currentTest: currentPageTest,
  inject: (key) => pageConfig().provided[key],
  pollTimeout: () => pageConfig().pollTimeout,
  recordVisualFailure: (test, failure) => {
    ((test as PageTest).artifacts ??= []).push(failure);
    return Promise.resolve();
  },
  describe,
  it,
};
