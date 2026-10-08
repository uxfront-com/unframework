import { compositionUse, defineTarget } from "@unframework/codegen";
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
    component: { support: "native" },
    "component-event": inert("A component's listener is inert"),
    "default-slot": { support: "native" },
    "named-slot": { support: "native" },
    "scoped-slot": {
      support: "emulated",
      helper: "<slot>",
      note: "A scoped slot is a render prop named as the slot: Astro loses a slot's arguments behind the `<Fragment slot>` its compiler writes (ADR-0054).",
    },
    "slot-fallback": { support: "native" },
    "default-slot-presence": { support: "native" },
    "slot-forwarding": { support: "native" },
    // A child that declares a model renders the prop's value (ADR-0054).
    model: { support: "native" },
    "two-way-binding": inert("A `v-model` renders its initial state and is inert"),
    "model-array": inert("A `v-model` of an array is inert"),
    "model-modifiers": inert("A `v-model`'s modifiers are inert"),
    fallthrough: { support: "native" },
    "contextual-root": { support: "native" },
    expose: inert("What a component exposes is never called"),
    context: {
      support: "unsupported",
      code: "UF4001",
      severity: "warning",
      reason:
        "Astro renders each component on its own, with no tree of instances to provide to, so `inject` gives its fallback (ADR-0054).",
    },
    "reactive-context": {
      support: "unsupported",
      code: "UF4001",
      severity: "warning",
      reason:
        "Astro renders each component on its own, so a provided ref reaches no descendant (ADR-0054).",
    },
    "dynamic-component": { support: "native" },
  },
  /**
   * One `.astro` file: the frontmatter at the very top (where Astro reads it, and where the
   * harness's canaries look for it) when it declares anything, then the markup. Each expression
   * is printed as the source writes it, with a state's or a computed's `x.value` as the constant
   * `x` the frontmatter declares (ADR-0046).
   */
  emit(component: UfComponent, context): OutputFile[] {
    // Composition's cells are declared before this target emits it (ADR-0055): until M3's lane
    // for Astro lands, a component that uses it is reported, never emitted without it (P2).
    const composition = compositionUse(context.module, component);
    if (composition) {
      context.report({
        code: "UF1002",
        severity: "error",
        message: `The astro target does not emit ${composition.what} yet: composition lands in M3.`,
        span: composition.span,
      });
      return [];
    }
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
