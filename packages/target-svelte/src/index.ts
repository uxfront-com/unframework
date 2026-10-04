import { defineTarget, printMarkup, svelteDialect } from "@unframework/codegen";
import type { EmitContext, OutputFile, Target } from "@unframework/codegen";
import type { UfComponent } from "@unframework/ir";

import { instanceScript } from "./script.ts";

/**
 * The options every component declares, so that it compiles the same whatever the consumer's
 * configuration. Runes mode: Svelte infers it from rune usage, so a component without runes
 * would otherwise compile in legacy mode. `preserveWhitespace={false}`, Svelte's default, which
 * the markup's layout is printed for (`svelteDialect`): with a consumer's
 * `preserveWhitespace: true`, the indentation would become text.
 */
const OPTIONS = "<svelte:options runes={true} preserveWhitespace={false} />";

/**
 * The Svelte 5 target: runes-mode components. A component is its options, its instance script
 * when it takes props (`script.ts`), and its markup, printed in `svelteDialect` (design §5.3).
 */
export const svelte: Target = defineTarget({
  name: "svelte",
  framework: { package: "svelte", range: ">=5.57 <6" },
  capabilities: {
    element: { support: "native" },
    text: { support: "native" },
    "static-attribute": { support: "native" },
    listbox: { support: "native" },
    interactivity: { support: "native" },
    props: { support: "native" },
    interpolation: { support: "native" },
    conditional: { support: "native" },
    list: { support: "native" },
    fragment: { support: "native" },
    "bound-attribute": { support: "native" },
    "class-binding": { support: "native" },
    "style-binding": { support: "native" },
    "attribute-spread": { support: "native" },
    svg: { support: "native" },
  },
  emit(component: UfComponent, context: EmitContext): OutputFile[] {
    const { block, rewrite } = instanceScript(component, context.module);
    // The component resolves the names of loop variables and tells whether a spread's object
    // may be absent (read through `?.`).
    const markup = printMarkup(component.render, svelteDialect, {
      component,
      ...(rewrite ? { rewrite } : {}),
    });
    const parts = block === undefined ? [OPTIONS, markup] : [OPTIONS, block, markup];
    return [{ path: `${component.name}.svelte`, contents: `${parts.join("\n\n")}\n` }];
  },
});

export default svelte;
