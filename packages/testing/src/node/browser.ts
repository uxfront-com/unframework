// The browser every parity project runs (plan §7.6, the screenshot ADR): headless Chromium with
// a fixed viewport at DPR 1, in the light scheme, with reduced motion, with font hinting off,
// which makes geometry identical on macOS and Linux, and with whole-tile raster, which makes a
// capture's pixels a function of the DOM alone. The setup file asserts the context. The nightly
// runs Firefox and WebKit in the same context, without Chromium's switches (ADR-0066).
import { playwright } from "@vitest/browser-playwright";
import type { BrowserConfigOptions } from "vitest/node";

import type { BrowserEngine } from "../harness.ts";
import { ACTION_TIMEOUT, CHROMIUM_ARGS, CONTEXT_OPTIONS } from "./browser-options.ts";
import { browserCommands } from "./commands.ts";
import { VIEWPORT } from "./viewport.ts";

export { ACTION_TIMEOUT } from "./browser-options.ts";
export { VIEWPORT } from "./viewport.ts";

/**
 * A browser command of any signature. Vitest calls it with its command context and the payload
 * the browser sent, which only the command and its caller agree on.
 */
export type AnyBrowserCommand = (context: never, ...payload: never[]) => unknown;

/** Options for {@link parityBrowser}. */
export interface ParityBrowserOptions {
  /** The project's name, also the instance's (or Vitest appends " (chromium)"). */
  name: string;
  /** Commands besides the testing API's own, such as a target's server-side render. */
  commands?: Readonly<Record<string, AnyBrowserCommand>>;
  /** The engine (`UF_BROWSER`, through the harness's mode); Chromium by default. */
  browser?: BrowserEngine;
}

/**
 * The `test.browser` options of a project that runs the parity layers. A target's command may
 * not take the name of one of the testing API's: it would replace the write policy or the
 * visual comparison for that project without a word.
 */
export function parityBrowser(options: ParityBrowserOptions): BrowserConfigOptions {
  const taken = Object.keys(options.commands ?? {}).filter((name) =>
    Object.hasOwn(browserCommands, name),
  );
  if (taken.length) {
    throw new Error(
      `[uf] parityBrowser(${options.name}): ${taken.join(", ")} would replace the testing API's own command(s). Give the target's command another name.`,
    );
  }
  const browser = options.browser ?? "chromium";
  return {
    enabled: true,
    // Headed runs inherit the host's device pixel ratio; the captures need DPR 1.
    headless: true,
    viewport: VIEWPORT,
    provider: playwright({
      // Every Playwright call in the context waits this long at most (`setDefaultTimeout`):
      // the actions, and the ARIA snapshot and focus commands. The visual command names its
      // own timeouts.
      actionTimeout: ACTION_TIMEOUT,
      // Firefox and WebKit have no such switches; their captures compare live within the engine.
      launchOptions: { args: browser === "chromium" ? [...CHROMIUM_ARGS] : [] },
      contextOptions: { ...CONTEXT_OPTIONS },
    }),
    instances: [{ browser, name: options.name }],
    // Vitest types each command against its own context; these take the parts they read.
    commands: { ...browserCommands, ...options.commands } as BrowserConfigOptions["commands"],
  };
}
