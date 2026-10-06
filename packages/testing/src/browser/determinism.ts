import regular from "@fontsource/inter/files/inter-latin-400-normal.woff2?url";
// Visual determinism for every browser project (plan §7.6, the screenshot ADR).
//
// - Fonts: one bundled OFL font (Inter, from @fontsource/inter) under a family name no system
//   has, loaded through the FontFace API before anything mounts. The visual command audits the
//   fonts Chromium actually used, so a fallback to a system font fails instead of passing.
// - Motion: animations, transitions and the caret are off here; the browser context also sets
//   prefers-reduced-motion (the project's `contextOptions`), which the startup check asserts.
// - Viewport and DPR: fixed by the project (800×600, deviceScaleFactor 1), asserted here.
// The font files are imported with Vite's `?url`, typed by vite/client (see tsconfig.json).
import bold from "@fontsource/inter/files/inter-latin-700-normal.woff2?url";

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
 * Installs the fonts and the reset once per page, after checking that the browser context is
 * the deterministic one. Every later call returns the same promise, so a failure fails every
 * test that depends on it.
 */
export function installDeterminism(): Promise<void> {
  ready ??= install();
  return ready;
}

async function install(): Promise<void> {
  const environment: Record<string, boolean> = {
    "devicePixelRatio: 1": window.devicePixelRatio === 1,
    "prefers-reduced-motion: reduce": matchMedia("(prefers-reduced-motion: reduce)").matches,
    "prefers-color-scheme: light": matchMedia("(prefers-color-scheme: light)").matches,
    "forced-colors: none": matchMedia("(forced-colors: none)").matches,
  };
  const wrong = Object.keys(environment).filter((name) => !environment[name]);
  if (wrong.length) {
    throw new Error(
      `Visual determinism: the browser context does not satisfy ${wrong.join(", ")}. The project must set the provider's contextOptions (see the screenshot ADR).`,
    );
  }
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
