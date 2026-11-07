// The browser every run of the parity layers opens, on either runner: no import of a runner, so the
// Vitest provider (`./browser.ts`) and the Playwright driver (`../driver/`) share it.

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
export const CHROMIUM_ARGS: readonly string[] = [
  "--font-render-hinting=none",
  "--disable-partial-raster",
];

/** The context the captures need, in every engine. The setup file asserts it. */
export const CONTEXT_OPTIONS: {
  deviceScaleFactor: number;
  colorScheme: "light";
  reducedMotion: "reduce";
  forcedColors: "none";
  locale: string;
  timezoneId: string;
} = {
  deviceScaleFactor: 1,
  colorScheme: "light",
  reducedMotion: "reduce",
  forcedColors: "none",
  locale: "en-US",
  timezoneId: "UTC",
};
