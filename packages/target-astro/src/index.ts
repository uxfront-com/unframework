import { defineTarget } from "@unframework/codegen";
import type { OutputFile, Target } from "@unframework/codegen";
import type { UfComponent } from "@unframework/ir";

import { frontmatterOf } from "./frontmatter.ts";
import { printComponentMarkup } from "./markup.ts";

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
  /**
   * One `.astro` file: the frontmatter at the very top (where Astro reads it, and where the
   * harness's canaries look for it) when the component takes props, then the markup. Each
   * expression is printed as the source writes it, but for a renamed props object: the
   * frontmatter declares every name the markup reads as the source does (design §5.7).
   */
  emit(component: UfComponent, context): OutputFile[] {
    const { code, rewrite } = frontmatterOf(component, context.module);
    const markup = printComponentMarkup(component, rewrite);
    return [
      {
        path: `${component.name}.astro`,
        contents: code === undefined ? `${markup}\n` : `---\n${code}---\n\n${markup}\n`,
      },
    ];
  },
});

export default astro;
