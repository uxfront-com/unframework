import { childIsAsync, defineTarget, printMarkup, vueDialect } from "@unframework.dev/codegen";
import type {
  EmitContext,
  MarkupPiece,
  OutputFile,
  PrintedAttribute,
  Target,
} from "@unframework.dev/codegen";
import type { UfComponent } from "@unframework.dev/ir";

import { emitComposable } from "./composable.ts";
import { emitDirective } from "./directive.ts";
import { asyncRootChild, scriptSetup } from "./script.ts";

/**
 * The Vue 3.5 target, the reference (D10): single-file components. A component is its
 * `<script setup lang="ts">` (`script.ts`), when it has props, events, setup code or a listener
 * its template cannot hold, then its template, printed in `vueDialect` (plan §6): a setup
 * ref's value read as the ref, which Vue unwraps, and each listener as `listeners.ts` plans it.
 * A component with none of those is a template alone.
 */
export const vue: Target = defineTarget({
  name: "vue",
  framework: { package: "vue", range: ">=3.5 <4" },
  capabilities: {
    element: { support: "native" },
    text: { support: "native" },
    "static-attribute": { support: "native" },
    // Only Vue's client mount differs: its server render and stringified templates are right,
    // and no template avoids it (`:size` and `v-bind` are patched after the children too). The
    // client parity test fails once Vue sets `size` before the options: mark it native then.
    listbox: {
      support: "unsupported",
      code: "UF4001",
      severity: "error",
      reason:
        "runtime-dom's `nodeOps.createElement` sets `multiple` but not `size` before the options are inserted, so Vue's client selects the first option, as a drop-down does.",
    },
    // The source's Composition API is Vue's (ADR-0045 to ADR-0049): state, watchers, hooks,
    // template refs and `emit` are written as Vue writes them, listeners as `@click`, their
    // options as Vue's modifiers (`.capture`, `.once`, `.passive`, which runtime-dom passes to
    // `addEventListener`), on the DOM's own events.
    interactivity: { support: "native" },
    "event-capture": { support: "native" },
    "event-once": { support: "native" },
    "event-passive": { support: "native" },
    "event-semantics": { support: "native" },
    "conditional-event-control": { support: "native" },
    "use-id": { support: "native" },
    "next-tick": { support: "native" },
    // Vue's props are reactive whatever keys a parent passes.
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
    "raw-html": { support: "native" },
    svg: { support: "native" },
    component: { support: "native" },
    "component-event": { support: "native" },
    "default-slot": { support: "native" },
    "named-slot": { support: "native" },
    "scoped-slot": { support: "native" },
    "slot-fallback": { support: "native" },
    "default-slot-presence": { support: "native" },
    "slot-forwarding": { support: "native" },
    model: { support: "native" },
    "two-way-binding": { support: "native" },
    "model-array": { support: "native" },
    "model-modifiers": { support: "native" },
    fallthrough: { support: "native" },
    "contextual-root": { support: "native" },
    expose: { support: "native" },
    context: { support: "native" },
    "reactive-context": { support: "native" },
    "dynamic-component": { support: "native" },
    "scoped-styles": { support: "native" },
    "child-root-scope": { support: "native" },
    "slotted-styles": { support: "native" },
    // A sheet loads as its module evaluates, in import order, as Vue's does (ADR-0063).
    "sheet-order": { support: "native" },
    "generic-components": { support: "native" },
    "generic-slot-props": { support: "native" },
    composables: { support: "native" },
    "composable-effect-order": { support: "native" },
    hydration: { support: "native" },
    "keyed-identity": { support: "native" },
    // Vue's own `<Teleport>`, behind a ref set once mounted, so the server renders none of it
    // (ADR-0098).
    teleport: { support: "native" },
    // Vue's own `<Transition>` (ADR-0100), whose contract the other targets emulate.
    transition: { support: "native" },
    // Vue's own custom directive, whose `updated` returns early on the same value (ADR-0099).
    directive: { support: "native" },
    // Top-level `await` in `<script setup>`, under a `<Suspense>` the parent prints (ADR-0101).
    "async-setup": { support: "native" },
  },
  emit(component: UfComponent, context: EmitContext): OutputFile[] {
    const { block, rewrite, listeners, components, keys, textCaret, mounted } = scriptSetup(
      component,
      context.module,
    );
    const root = asyncRootChild(component, context.module);
    /** Each piece of an async child, inside a `<Suspense>` that takes the piece's directives. */
    const suspended = (pieces: readonly MarkupPiece[]): MarkupPiece[] =>
      pieces.map((piece) => {
        if (
          piece.kind !== "component" ||
          !childIsAsync(context.module, piece.component.component)
        ) {
          return piece;
        }
        const attrs: PrintedAttribute[] =
          piece.component === root ? [{ name: "v-bind", text: 'v-bind="$attrs"' }] : [];
        return {
          kind: "tag",
          tag: "Suspense",
          attributes: piece.directives,
          content: [{ kind: "component", component: piece.component, directives: attrs }],
        };
      });
    const dialect: typeof vueDialect = {
      ...vueDialect,
      // A bound `<textarea>` takes the directive that puts its caret after its text (ADR-0095).
      ...(textCaret === undefined
        ? {}
        : {
            modelAttribute: (model, context) => [
              ...vueDialect.modelAttribute!(model, context),
              ...(model.attribute.control === "textarea" ? [directiveAttribute(textCaret)] : []),
            ],
          }),
      // A teleport mounts its content once the component has mounted (ADR-0098).
      ...(mounted === undefined
        ? {}
        : {
            teleport: ({ node }) => [
              {
                kind: "tag",
                tag: "Teleport",
                attributes: [
                  { name: "v-if", text: `v-if="${mounted}"` },
                  { name: "to", text: vueDialect.attribute("to", node.to, "") },
                ],
                content: [{ kind: "nodes", nodes: node.children, container: node }],
              },
            ],
          }),
      // Vue's own `<Transition>` (ADR-0100). `appear` is bound as an object: the server compiler
      // wraps the child in `<template>` when it finds `appear` as an attribute or a `:appear`
      // binding (compiler-ssr's `ssrTransformTransition`), which would leave the server HTML
      // unsettled, but it reads no object binding.
      // An async child renders under a `<Suspense>` of its own, which Vue requires (ADR-0101);
      // as the root, it takes the `$attrs` that `<Suspense>` would drop. A list's row and a
      // branch put their `v-for`, `:key` and `v-if` on the `<Suspense>`.
      component: (node) => suspended([{ kind: "component", component: node, directives: [] }]),
      conditional: (branches) => suspended(vueDialect.conditional(branches)),
      list: (parts) => suspended(vueDialect.list(parts)),
      transition: ({ node, container }) => [
        {
          kind: "tag",
          tag: "Transition",
          attributes: [
            ...(node.name === "v"
              ? []
              : [{ name: "name", text: vueDialect.attribute("name", node.name, "") }]),
            ...(node.appear ? [{ name: "v-bind", text: 'v-bind="{ appear: true }"' }] : []),
          ],
          content: [{ kind: "nodes", nodes: node.children, container }],
        },
      ],
    };
    // The component resolves the names of loop variables.
    const template = printMarkup(component.render, dialect, {
      level: 1,
      component,
      module: context.module,
      rewrite,
      attribute: (attribute) =>
        attribute.kind === "Event" ? listeners.attributes.get(attribute) : undefined,
      componentTag: (name) => components.get(name),
    });
    // The sheet `compile()` emits beside the source, already scoped, so the block is not
    // `scoped`; plugin-vue resolves its `src` through the unplugin (ADR-0063).
    const file = context.module.file;
    const sheet = component.styles
      ? [`<style src="./${file.slice(file.lastIndexOf("/") + 1)}.css"></style>`]
      : [];
    const parts = [
      ...(keys === undefined ? [] : [keys]),
      ...(block === undefined ? [] : [block]),
      `<template>\n${template}\n</template>`,
      ...sheet,
    ];
    return [{ path: `${component.name}.vue`, contents: `${parts.join("\n\n")}\n` }];
  },
  emitComposable,
  emitDirective,
});

export default vue;

/** A local directive's attribute, `v-text-caret` for `vTextCaret`. */
function directiveAttribute(name: string): { name: string; text: string } {
  const attribute = `v-${name
    .slice(1)
    .replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
    .replace(/^-/, "")}`;
  return { name: attribute, text: attribute };
}
