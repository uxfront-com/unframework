import { defineTarget, printMarkup, svelteDialect } from "@unframework/codegen";
import type { OutputFile, Target } from "@unframework/codegen";
import type { UfComponent } from "@unframework/ir";

/**
 * The options every component declares, so that it compiles the same whatever the consumer's
 * configuration. Runes mode: Svelte infers it from rune usage, so a component without runes
 * would otherwise compile in legacy mode. `preserveWhitespace={false}`, Svelte's default, which
 * the markup's layout is printed for (`svelteDialect`): with a consumer's
 * `preserveWhitespace: true`, the indentation would become text.
 */
const OPTIONS = "<svelte:options runes={true} preserveWhitespace={false} />";

/** The Svelte 5 target: runes-mode components. */
export const svelte: Target = defineTarget({
  name: "svelte",
  framework: { package: "svelte", range: ">=5.57 <6" },
  capabilities: {
    element: { support: "native" },
    text: { support: "native" },
    "static-attribute": { support: "native" },
    listbox: { support: "native" },
    interactivity: { support: "native" },
  },
  emit(component: UfComponent): OutputFile[] {
    return [
      {
        path: `${component.name}.svelte`,
        contents: `${OPTIONS}\n\n${printMarkup(component.render, svelteDialect)}\n`,
      },
    ];
  },
});

export default svelte;
