// The browser every parity project runs (plan §7.6, the screenshot ADR): headless Chromium with
// a fixed viewport at DPR 1, in the light scheme, with reduced motion, and with font hinting
// off, which makes geometry identical on macOS and Linux. The setup file asserts the context.
import { playwright } from "@vitest/browser-playwright";
import type { BrowserConfigOptions } from "vitest/node";

import { browserCommands } from "./commands.ts";

/** The tester iframe's size; layout depends on it, so it never changes. */
export const VIEWPORT: { readonly width: number; readonly height: number } = {
  width: 800,
  height: 600,
};

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
      // Linux headless Chromium hints glyph advances to whole pixels; without hinting, text
      // measures the same on macOS and Linux (form controls still differ, so committed
      // geometry is a Linux baseline, like the pixels).
      launchOptions: { args: ["--font-render-hinting=none"] },
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
