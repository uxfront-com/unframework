// The browser every parity project runs (plan §7.6, the screenshot ADR): headless Chromium with
// a fixed viewport at DPR 1, in the light scheme, with reduced motion, with font hinting off,
// which makes geometry identical on macOS and Linux, and with whole-tile raster, which makes a
// capture's pixels a function of the DOM alone. The setup file asserts the context.
import { playwright } from "@vitest/browser-playwright";
import type { BrowserConfigOptions } from "vitest/node";

import { browserCommands } from "./commands.ts";
import { VIEWPORT } from "./viewport.ts";

export { VIEWPORT } from "./viewport.ts";

/**
 * How long a user's action (`view.user.click`, …) waits for its element, as `expect.element`
 * waits the poll timeout (ADR-0043): without it the provider waits for the whole test's
 * timeout, so a locator that matches nothing would hold a failing test, or a browser canary,
 * for a minute.
 */
export const ACTION_TIMEOUT = 5_000;

/**
 * The switches Chromium launches with, for the captures (L10):
 *
 * - `--font-render-hinting=none`: Linux headless Chromium hints glyph advances to whole pixels;
 *   without hinting, text measures the same on macOS and Linux (form controls still differ, so
 *   committed geometry is a Linux baseline, like the pixels).
 * - `--disable-partial-raster`: by default a repaint re-rasterises only the repainted rect,
 *   rounded out to whole pixels, over the tile's old pixels. Where a control starts mid-pixel,
 *   that edge cuts the anti-aliased corner of the box beside it, which then rasterises one level
 *   apart from a whole raster: the same DOM captured differently after a hover, a press or a
 *   keystroke repainted one control, depending on which repaints each frame grouped, which
 *   differs by target and by load. Each repainted tile is rasterised whole instead, so a capture
 *   depends on the DOM, never on what was repainted before it (test/parity/cases/stub/raster).
 *   Every reference capture of the corpus is byte-identical with and without it.
 */
const CHROMIUM_ARGS: readonly string[] = ["--font-render-hinting=none", "--disable-partial-raster"];

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
      launchOptions: { args: [...CHROMIUM_ARGS] },
      contextOptions: {
        deviceScaleFactor: 1,
        colorScheme: "light",
        reducedMotion: "reduce",
        forcedColors: "none",
        locale: "en-US",
        timezoneId: "UTC",
      },
    }),
    instances: [{ browser: "chromium", name: options.name }],
    // Vitest types each command against its own context; these take the parts they read.
    commands: { ...browserCommands, ...options.commands } as BrowserConfigOptions["commands"],
  };
}
