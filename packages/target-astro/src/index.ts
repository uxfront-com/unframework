import { defineTarget } from "@unframework/codegen";
import type { CapabilityCell, OutputFile, Target } from "@unframework/codegen";
import type { UfComponent } from "@unframework/ir";

import { frontmatterOf } from "./frontmatter.ts";
import { printComponentMarkup } from "./markup.ts";
import { UNIQUE_ID } from "./setup.ts";

/**
 * Why nothing runs in the browser (ADR-0045, ADR-0047): Astro renders each component once, on
 * the server, so a render is a new instance and no client code exists to run.
 */
const STATIC =
  "Astro components render on the server only, and each render is a new instance: event handlers, template refs, watchers and lifecycle hooks never run, and state keeps its initial value.";

/**
 * A capability that only client code uses: inert on Astro, reported (UF4001, for information)
 * only where `interactivity` is not reported at the same use, which it refines.
 */
const inert = (what: string): CapabilityCell => ({
  support: "unsupported",
  code: "UF4001",
  severity: "info",
  reason: `${what} on Astro: components render on the server only, and nothing runs in the browser.`,
});

/** The Astro 7 target: static components with no client runtime. */
export const astro: Target = defineTarget({
  name: "astro",
  framework: { package: "astro", range: ">=7.3 <8" },
  capabilities: {
    element: { support: "native" },
    text: { support: "native" },
    "static-attribute": { support: "native" },
    listbox: { support: "native" },
    interactivity: { support: "unsupported", code: "UF4001", severity: "info", reason: STATIC },
    "event-capture": inert("A capture listener is inert"),
    "event-once": inert("A once listener is inert"),
    "event-passive": inert("A passive listener is inert"),
    "event-semantics": inert("A listener is inert"),
    "conditional-event-control": inert("An event control is inert"),
    "use-id": {
      support: "emulated",
      helper: UNIQUE_ID,
      note: "A counter on `Astro.locals`, which lives for one request: ids are unique on the page.",
    },
    "next-tick": inert("`nextTick()` never runs"),
    // Each render is a new instance, which reads its props afresh.
    "late-prop": { support: "native" },
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
   * harness's canaries look for it) when it declares anything, then the markup. Each expression
   * is printed as the source writes it, with a state's or a computed's `x.value` as the constant
   * `x` the frontmatter declares (ADR-0046).
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
