import { astroDialect, defineTarget, printMarkup } from "@unframework/codegen";
import type { OutputFile, Target } from "@unframework/codegen";
import type { UfComponent } from "@unframework/ir";

/** The Astro 7 target: static components with no client runtime. */
export const astro: Target = defineTarget({
  name: "astro",
  framework: { package: "astro", range: ">=7.3 <8" },
  capabilities: {
    element: { support: "native" },
    text: { support: "native" },
    "static-attribute": { support: "native" },
    listbox: { support: "native" },
    interactivity: {
      support: "unsupported",
      code: "UF4001",
      severity: "info",
      reason: "Astro components render on the server only; event handlers are inert.",
    },
  },
  emit(component: UfComponent): OutputFile[] {
    return [
      {
        path: `${component.name}.astro`,
        contents: `${printMarkup(component.render, astroDialect)}\n`,
      },
    ];
  },
});

export default astro;
