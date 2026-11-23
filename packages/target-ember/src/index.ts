import { CAPABILITY_NAMES, defineTarget } from "@unframework.dev/codegen";
import type {
  Capabilities,
  CapabilityCell,
  CapabilityName,
  EmitContext,
  OutputFile,
  Target,
} from "@unframework.dev/codegen";
import type { Span, UfComponent } from "@unframework.dev/ir";

import { emitComponent, emitComposable } from "./component.ts";
import { emitDirective } from "./directive.ts";

const NATIVE: CapabilityCell = { support: "native" };

/**
 * The cells the target leaves unsupported by design, as warnings: the component compiles, and
 * only what the cell names behaves differently.
 */
const BY_DESIGN: Partial<Record<CapabilityName, CapabilityCell>> = {
  "late-prop": {
    support: "unsupported",
    code: "UF4001",
    severity: "warning",
    reason:
      "An Ember parent names each argument in its template, so it never adds one after mount, and the target does not make a component follow one that appears later: a parent that would add an argument late passes it from the start, `undefined` while it has no value.",
  },
};

/** The cells whose feature the output builds with an inline helper, by capability. */
const EMULATED: Partial<Record<CapabilityName, CapabilityCell>> = {
  // Glimmer writes `true` as an empty attribute and leaves `false` out, where Vue writes an
  // ARIA or enumerated attribute's boolean as its name, `aria-expanded="false"`.
  "bound-attribute": {
    support: "emulated",
    helper: "enumeratedValue",
    note: 'Glimmer writes `true` as an empty attribute and leaves `false` out, where Vue writes the boolean of an ARIA attribute and of contenteditable, draggable and spellcheck as its name. So such a value goes through an inline helper, enumeratedValue, that writes "true" or "false" and passes any other value as it is.',
  },
  "attribute-spread": {
    support: "emulated",
    helper: "enumeratedValue",
    note: "A spread is written out per key, and an ARIA or enumerated key goes through enumeratedValue, as a bound one does, so a boolean is written as its name.",
  },
  // A Glimmer `class` is one string.
  "class-binding": {
    support: "emulated",
    helper: "classNames",
    note: "A Glimmer `class` is one string, so an inline helper, classNames, joins the static names, toggles and dynamic parts, and reads an array's entries and an object's keys as Vue's normalizeClass does.",
  },
  directive: {
    support: "emulated",
    helper: "queueHook",
    note: "A directive is a modifier on Ember's own manager. Glimmer installs a parent's modifier before its children's, so each hook goes through an inline helper, queueHook, that runs them in Vue's order, and no hook runs on the server.",
  },
  "dynamic-component": {
    support: "emulated",
    helper: "{{#if}}",
    note: "Glimmer has no `<component is>` over a tag, so each candidate is a branch of an `{{#if}}`: a tag where the choice is its name, a component where it is the component.",
  },
  expose: {
    support: "emulated",
    helper: "componentRef",
    note: "A Glimmer component has no instance a parent can hold, so a component ref is the child's `@ref` argument, a callback from an inline helper, componentRef: the child calls it with what `defineExpose` exposes once it has rendered, and with `null` once it is gone.",
  },
  transition: {
    support: "emulated",
    helper: "Transition",
    note: "Glimmer removes an element once its `{{#if}}` turns false, so a transition renders its elements from a list, an inline helper's `Transition.entries`: the element of the branch its condition shows, and each one still leaving, until its leave ends. An inline modifier, transitionClasses, runs Vue's classes of each phase on the element, in the browser only.",
  },
  "async-setup": {
    support: "emulated",
    helper: "AsyncSetup",
    note: "The setup's statements from its first `await` on run as the component is constructed, in an inline helper, AsyncSetup, and the template renders nothing until they have run, as Vue's `<Suspense>` shows none of it. A component destroyed while it waits runs no more of its setup.",
  },
  fallthrough: {
    support: "emulated",
    helper: "fallthroughStyle",
    note: "A caller's `class` reaches the root through `...attributes`, where Glimmer joins it with the root's own. Glimmer lets a caller's `style` attribute replace the root's own, so a `style` is the `@style` argument, which an inline helper, fallthroughStyle, merges into the root's declarations as Vue does.",
  },
  "reactive-context": {
    support: "emulated",
    helper: "refOf",
    note: "A provided state is its ref as descendants read it: an inline helper, refOf, makes an object whose `value` getter reads the tracked field, so a descendant renders each change.",
  },
  // A Glimmer `style` is one string, which Ember asks to be marked safe.
  interactivity: {
    support: "emulated",
    helper: "Watcher",
    note: "State, derived values, listeners and template refs are tracked fields, getters, `{{on}}` and an inline modifier. Glimmer has no effects, so a watcher and a watchEffect go through inline helpers, Watcher and Effect, that the template calls before and after its content: a watcher calls back right after the render that sees a change, with Vue's previous value, change test and cleanup timing, and an effect runs once the render settles. The lifecycle hooks run once the first render settles, and never on the server.",
  },
  "two-way-binding": {
    support: "emulated",
    helper: "toggle",
    note: "A `v-model` is the control's property and a listener that writes it back, as Vue's directives bind each control: `value` and `input` for a text field, `checked` and `change` for a checkbox, an option's `selected` and `change` for a `<select>`.",
  },
  "model-array": {
    support: "emulated",
    helper: "toggle",
    note: "A checkbox group's array goes through an inline helper, `toggle`, as Vue's `vModelCheckbox` does, and a `<select multiple>` writes its selected options' values.",
  },
  "model-modifiers": {
    support: "emulated",
    helper: "modelText",
    note: "A `v-model`'s modifiers and a number control's cast follow Vue's `vModelText` through an inline modifier, `modelText`.",
  },
  "style-binding": {
    support: "emulated",
    helper: "styleText",
    note: "A Glimmer `style` is one string, so an inline helper, styleText, writes the declarations whose value is present and marks the string safe with htmlSafe, as Ember asks of a bound style.",
  },
};

/** The cells the output builds with Ember's own features: each that no other record holds. */
const SUPPORTED: ReadonlySet<CapabilityName> = new Set<CapabilityName>([
  "element",
  "text",
  "static-attribute",
  // A Glimmer component has no host element: its root is the parent's child.
  "contextual-root",
  "props",
  "interpolation",
  "conditional",
  "list",
  "fragment",
  "bound-attribute",
  "class-binding",
  "style-binding",
  "attribute-spread",
  "raw-html",
  "svg",
  // Ember has no context API yet: RFC 1200 (emberjs/rfcs#1200) proposes `createContext`, with
  // draft implementations in emberjs/ember.js#21450 and, on the dynamic scope, #21789. Until one
  // lands, the output follows ember-primitives' dom-context inline: a provider's text node in its
  // root, which `inject` finds by walking up the DOM. A provided state is its ref, `{ value }`.
  "context",
  "reactive-context",
  // `{{on}}` adds the listener to its element, with `addEventListener`'s options, and the
  // handler runs as the event is dispatched.
  "interactivity",
  "event-capture",
  "event-once",
  "event-passive",
  "event-semantics",
  "conditional-event-control",
  // A directive is a modifier on Ember's own manager (`directive.ts`).
  "directive",
  "dynamic-component",
  // An id counted per application, the same on the server and on the client that hydrates it.
  "use-id",
  // `renderSettled` from `@ember/renderer`, which resolves once the pending render has run.
  "next-tick",
  // `{{#each}}` keeps a keyed row's element, and a `<select>`'s `size` is set when the element
  // opens, before its options.
  "keyed-identity",
  "listbox",
  // The module imports the sheet `compile()` scopes, and each element carries its attribute.
  "scoped-styles",
  "sheet-order",
  "two-way-binding",
  "model-array",
  "model-modifiers",
  // A child is its output's component, which the template's lexical scope holds.
  "component",
  "component-event",
  // Slots are blocks: `{{yield to="header"}}`, `<:header>`, and `(has-block "header")`.
  "default-slot",
  "named-slot",
  "scoped-slot",
  "slot-fallback",
  "default-slot-presence",
  // A parent's `data-uf-…` attribute on a child's tag reaches the child's root through
  // `...attributes`.
  "child-root-scope",
  // A fill is the parent's own markup, so its elements carry the parent's attribute.
  "slotted-styles",
  "fallthrough",
  "expose",
  // A model is the child's argument and an `@onUpdateValue` callback, as Ember passes actions.
  "model",
  // `{{#in-element}}` appends a teleport's content to its target, in the browser only.
  "teleport",
  "transition",
  // A forwarded slot yields to the component's own block, in a branch for each set of the
  // forwarded slots the component got, as Glimmer passes a named block unconditionally.
  "slot-forwarding",
  // A generic component is a class whose signature takes its type parameters, which Glint
  // infers from a parent's arguments.
  "generic-components",
  "generic-slot-props",
  // An async setup runs as the component is constructed, and the template waits for it.
  "async-setup",
  // A composable is a class its function makes, which takes the calling component, whose hooks
  // its own run with, in the order the setup registers them.
  "composables",
  "composable-effect-order",
  // The hydrate adapter boots the app the server rendered with in Glimmer's rehydrate mode.
  "hydration",
]);

/** A capability the target declares no cell for: a new one in `CAPABILITY_NAMES`. */
function undeclared(name: CapabilityName): never {
  throw new Error(`The Ember target declares no cell for \`${name}\`.`);
}

const CAPABILITIES = Object.fromEntries(
  CAPABILITY_NAMES.map((name) => [
    name,
    BY_DESIGN[name] ?? EMULATED[name] ?? (SUPPORTED.has(name) ? NATIVE : undeclared(name)),
  ]),
) as Capabilities;

/**
 * What keeps the target from emitting a component's context, with where: a provider's marker
 * sits in its root element, where the root's descendants find it and no sibling of the root does,
 * so a component that provides needs one.
 */
function contextProblem(component: UfComponent): { message: string; span: Span } | undefined {
  const provide = component.setup.find((item) => item.kind === "Provide");
  if (!provide || component.render.kind === "Element") return undefined;
  return {
    message:
      "`provide` needs a root element on Ember: the provided values' marker sits in it, and a later sibling of a marker outside it would find it. See uxfront-com/unframework#236.",
    span: provide.span,
  };
}

/**
 * The Ember 7.4 target: one `.gts` file per component. A component with no state of its own is
 * a template-only component (`TOC`); any other is a `@glimmer/component` class, whose template
 * reads each expression the template language cannot hold through a member of the class
 * (`component.ts`).
 */
export const ember: Target = defineTarget({
  name: "ember",
  framework: { package: "ember-source", range: ">=7.4 <8" },
  capabilities: CAPABILITIES,
  emit(component: UfComponent, context: EmitContext): OutputFile[] {
    const unsupported = contextProblem(component);
    if (unsupported) {
      context.report({ code: "UF4001", severity: "error", ...unsupported });
      return [];
    }
    return [{ path: `${component.name}.gts`, contents: emitComponent(component, context) }];
  },
  emitComposable,
  emitDirective,
});

export default ember;
