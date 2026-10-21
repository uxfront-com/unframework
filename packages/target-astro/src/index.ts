import { childImports, defineTarget, ImportSet } from "@unframework/codegen";
import type { CapabilityCell, OutputFile, Target } from "@unframework/codegen";
import type { UfComponent } from "@unframework/ir";

import { astroRender, takesFallthrough } from "./composition.ts";
import { childTags, frontmatterOf } from "./frontmatter.ts";
import { printComponentMarkup } from "./markup.ts";
import { UNIQUE_ID } from "./setup.ts";
import { spellingOf } from "./spelling.ts";

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
    "scoped-styles": { support: "native" },
    "child-root-scope": { support: "native" },
    "slotted-styles": { support: "native" },
  },
  /**
   * One `.astro` file: the frontmatter at the very top (where Astro reads it, and where the
   * harness's canaries look for it) when it declares anything, then the markup. Each expression
   * is printed as the source writes it, with a state's or a computed's `x.value` as the constant
   * `x` the frontmatter declares (ADR-0046). Composition is written in Astro's shape
   * (`./composition.ts`, ADR-0054): the markup is printed first, since whether it names `Astro`
   * decides how the frontmatter declares `Props`.
   */
  emit(component: UfComponent, context): OutputFile[] {
    const { module } = context;
    const spelling = spellingOf(component, module);
    const imports = new ImportSet(spelling.scope);
    const tags = childTags(
      childImports(component, module, (name) => `${name}.astro`),
      imports,
    );
    const fallthrough = takesFallthrough(component)
      ? { className: spelling.scope.claim("className"), style: spelling.scope.claim("style") }
      : undefined;
    const render = astroRender(component, module, spelling, fallthrough);
    const markup = printComponentMarkup(component, spelling.rules, {
      spelling,
      render,
      tags,
      module,
    });
    const code = frontmatterOf(component, module, {
      spelling,
      imports,
      render,
      markupNamesAstro: /\bAstro\./.test(markup),
    });
    return [
      {
        path: `${component.name}.astro`,
        contents: code === undefined ? `${markup}\n` : `---\n${code}---\n\n${markup}\n`,
      },
    ];
  },
});

export default astro;
