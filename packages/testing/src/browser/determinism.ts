import regular from "@fontsource/inter/files/inter-latin-400-normal.woff2?url";
// Visual determinism for every browser project (plan §7.6, the screenshot ADR).
//
// - Fonts: one bundled OFL font (Inter, from @fontsource/inter) under a family name no system
//   has, loaded through the FontFace API before anything mounts. The visual command audits the
//   fonts Chromium actually used, so a fallback to a system font fails instead of passing.
// - Motion: animations, transitions and the caret are off here; the browser context also sets
//   prefers-reduced-motion (the project's `contextOptions`), which the startup check asserts.
// - Colour scheme: light, unless the case opts into dark (`case.json`'s `colorScheme`,
//   ADR-0061); the setup file emulates it for every spec file, and the startup check asserts the
//   file's scheme once it applies, waiting at most five seconds (ADR-0081). Spec files share a
//   page (ADR-0092), so the check runs for each file, and the fonts and the reset install once.
// - Viewport and DPR: fixed by the project (800×600, deviceScaleFactor 1), asserted here.
// The font files are imported with Vite's `?url`, typed by vite/client (see tsconfig.json).
import bold from "@fontsource/inter/files/inter-latin-700-normal.woff2?url";

import type { ColorScheme } from "../harness.ts";

/** The only family allowed to render text in a capture. No system has a font by this name. */
export const FONT_FAMILY = "UF Test Sans";

/** The attribute that marks a mount root; the reset below gives it a tight, padded box. */
export const ROOT_ATTRIBUTE = "data-uf-root";

const RESET = `
:root {
  color-scheme: light;
  font-family: "${FONT_FAMILY}";
  font-size: 16px;
  line-height: 1.5;
  font-kerning: normal;
  -webkit-text-size-adjust: 100%;
}
html, body { margin: 0; padding: 0; background: #ffffff; color: #000000; }
/* Chromium's UA sheet does not inherit font-family into form controls, and gives the code
   elements the generic monospace family; without this they render with a system font, which the
   font audit rejects. They inherit the bundled family instead of bundling a monospace one: one
   family, one font file per weight, and the same text on every target either way. */
button, input, select, textarea, code, kbd, listing, plaintext, pre, samp, tt, xmp {
  font-family: inherit;
}
*, *::before, *::after {
  animation-duration: 0s !important;
  animation-delay: 0s !important;
  animation-iteration-count: 1 !important;
  transition: none !important;
  caret-color: transparent !important;
  scroll-behavior: auto !important;
}
[${ROOT_ATTRIBUTE}] { display: flow-root; width: max-content; padding: 8px; background: #ffffff; }
`;

let ready: Promise<void> | undefined;

/**
 * Checks that the browser context is the deterministic one, in the spec file's colour scheme,
 * then installs the fonts and the reset if the page has none yet. The setup file calls it for
 * every spec file, since files share a page (ADR-0092): each file's own scheme is checked, not
 * only the first file's.
 */
export async function prepareSpecFile(colorScheme: ColorScheme): Promise<void> {
  await checkEnvironment(colorScheme);
  await installDeterminism();
}

/**
 * Installs the fonts and the reset once per page. Every later call returns the same promise, so
 * a failure fails every test that depends on it.
 */
export function installDeterminism(): Promise<void> {
  ready ??= install();
  return ready;
}

/** How long the startup check waits for the case's colour scheme to reach the page (ADR-0081). */
export const COLOR_SCHEME_WAIT_MS = 5000;

/** How often the startup check reads the colour scheme again while it waits. */
const COLOR_SCHEME_POLL_MS = 50;

/**
 * Checks that the browser context is the deterministic one, in the case's colour scheme, and
 * throws, naming every entry it does not satisfy. The colour scheme alone is read again for at
 * most `COLOR_SCHEME_WAIT_MS` (ADR-0081, amending ADR-0061): in Firefox, the setup file's
 * emulation can reach the tester frame after the command that set it returns. The other entries
 * come from the context's options, which apply before the page loads, so they are read once.
 */
export async function checkEnvironment(colorScheme: ColorScheme): Promise<void> {
  const environment: Record<string, boolean> = {
    "devicePixelRatio: 1": window.devicePixelRatio === 1,
    "prefers-reduced-motion: reduce": matchMedia("(prefers-reduced-motion: reduce)").matches,
    [`prefers-color-scheme: ${colorScheme}`]: await matchesWithin(
      `(prefers-color-scheme: ${colorScheme})`,
      COLOR_SCHEME_WAIT_MS,
    ),
    "forced-colors: none": matchMedia("(forced-colors: none)").matches,
  };
  const wrong = Object.keys(environment).filter((name) => !environment[name]);
  if (wrong.length) {
    throw new Error(
      `Visual determinism: the browser context does not satisfy ${wrong.join(", ")}. The project must set the provider's contextOptions (see the screenshot ADR), and the setup file emulate the case's colour scheme (ADR-0061).`,
    );
  }
}

/** Whether the page matches `query`, read until it does or `timeout` milliseconds pass. */
async function matchesWithin(query: string, timeout: number): Promise<boolean> {
  const deadline = Date.now() + timeout;
  while (!matchMedia(query).matches) {
    if (Date.now() >= deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, COLOR_SCHEME_POLL_MS));
  }
  return true;
}

async function install(): Promise<void> {
  const style = document.createElement("style");
  style.setAttribute("data-uf-determinism", "");
  style.textContent = RESET;
  document.head.append(style);
  const faces = [
    new FontFace(FONT_FAMILY, `url(${regular}) format("woff2")`, { weight: "400" }),
    new FontFace(FONT_FAMILY, `url(${bold}) format("woff2")`, { weight: "700" }),
  ];
  for (const face of faces) {
    document.fonts.add(face);
    await face.load();
  }
  await document.fonts.ready;
  const failed = faces.filter((face) => face.status !== "loaded");
  if (failed.length) {
    throw new Error(
      `Visual determinism: ${failed.map((face) => `${face.family} ${face.weight}`).join(", ")} did not load.`,
    );
  }
}

/** Waits for what a capture depends on: the fonts, the target's settle hook and two frames. */
export async function settleFrame(targetSettle?: () => Promise<void>): Promise<void> {
  await installDeterminism();
  await targetSettle?.();
  await document.fonts.ready;
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}
