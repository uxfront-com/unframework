// The Astro source each browser project compiled, by virtual id. The browser project's pipeline
// (the unframework plugin, its golden guard and any canary) produces it; the render server
// renders exactly that source, so the browser checks run the code the browser project built.
// Plugins and browser commands both run in Vitest's main process, which makes this shared map
// the hand-over between them.

const compiled = new Map<string, string>();

/** Records the Astro source a browser project's pipeline produced for a virtual id. */
export function recordAstroSource(id: string, source: string): void {
  compiled.set(id, source);
}

/** The Astro source last recorded for a virtual id (without a query). */
export function compiledAstroSource(id: string): string | undefined {
  return compiled.get(id);
}
