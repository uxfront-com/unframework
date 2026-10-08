import {
  codeNames,
  codeKind,
  compositionUse,
  defineTarget,
  exportDeclaration,
  exportsOf,
  componentTypes,
  js,
  kebabCase,
  Placeholders,
  printExpression,
  printProgram,
  typeDeclarationCode,
  typeNames,
} from "@unframework/codegen";
import type { EmitContext, OutputFile, Target } from "@unframework/codegen";
import { codeOf, functionsOf } from "@unframework/ir";
import type { UfComponent, UfModule } from "@unframework/ir";

import { directiveCode } from "./directives.ts";
import { planListeners } from "./listeners.ts";
import { classMembers } from "./members.ts";
import { bindingById, planComponent } from "./plan.ts";
import { classRules } from "./rules.ts";
import { template, templateReads } from "./template.ts";
import { declaredTypes } from "./types.ts";

/** The note the emulated cells share: why a listener's option needs a directive. */
const OPTION_NOTE =
  "A template's `(event)` binding takes no listener options: the file declares an attribute directive per event and option (`[ufClickCapture]`) that listens with `Renderer2.listen` and re-emits the event (ADR-0047).";

/**
 * The Angular 22 target: standalone, zoneless components. The host element gets
 * `display: contents`, so it adds no box of its own (decision D6, ADR-0010). `standalone` and
 * OnPush change detection are Angular 22's defaults, so the metadata does not repeat them. It
 * does repeat `preserveWhitespaces: false`, the default the template's layout is printed for
 * (`angularDialect`): the component's own setting wins over a consumer's
 * `angularCompilerOptions`, which would otherwise turn the indentation into text.
 *
 * Each prop is a public signal input (ADR-0034), each event an output of its name
 * (ADR-0047); the setup's state, derived values and constants are signals and fields, its
 * functions methods, its effects Angular's (see ./members.ts); the template reads signals
 * through `@let` and each allowed global an expression reads as a protected member of the same
 * name, since a template sees only its component's members.
 */
export const angular: Target = defineTarget({
  name: "angular",
  framework: { package: "@angular/core", range: ">=22 <23" },
  capabilities: {
    element: { support: "native" },
    text: { support: "native" },
    "static-attribute": { support: "native" },
    listbox: { support: "native" },
    interactivity: { support: "native" },
    "event-capture": { support: "emulated", helper: "uf<Event>Capture", note: OPTION_NOTE },
    "event-once": {
      support: "emulated",
      helper: "uf<Event>Once",
      note: `${OPTION_NOTE} Beside another listener of its event on its element, which runs in attribute order with it in one template listener, it runs under a guard instead, \`once(clickOnce, $event) && …\`, a method that remembers the elements it ran on.`,
    },
    "event-passive": { support: "emulated", helper: "uf<Event>Passive", note: OPTION_NOTE },
    "event-semantics": { support: "native" },
    // Listeners run their handlers as the event is dispatched, controls and calls included.
    "conditional-event-control": { support: "native" },
    "use-id": {
      support: "emulated",
      helper: "nextId",
      note: "Angular has no id API: a module counter makes each instance's ids, `uf-id-<component>-<n>`, as Angular Material makes its own.",
    },
    "next-tick": {
      support: "emulated",
      helper: "nextTick",
      note: "Angular has no `nextTick`, and renders a change in a later task: a private method renders the pending change in a microtask with `ApplicationRef.tick()`, as Vue does, and resolves after it (ADR-0048).",
    },
    // Every declared input is a signal, set or not.
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
    "component-event": { support: "native" },
    "default-slot": { support: "native" },
    "named-slot": {
      support: "emulated",
      helper: "uf<Component><Slot>",
      note: "Each named slot is a directive the component's file exports, `ng-template[uf<Component><Slot>]`, read with `contentChild` and rendered with `ngTemplateOutlet` (ADR-0056).",
    },
    "scoped-slot": {
      support: "emulated",
      helper: "uf<Component><Slot>",
      note: "A scoped slot is a slot directive with `ngTemplateContextGuard`, so strict templates type the consumer's `let-` variables (ADR-0056).",
    },
    "slot-fallback": { support: "native" },
    "default-slot-presence": {
      support: "unsupported",
      code: "UF4001",
      severity: "error",
      reason:
        "Angular has no API for whether `<ng-content>` received content, and forwarding the default slot would re-project `<ng-content />`, which always counts as content (ADR-0056).",
    },
    "slot-forwarding": {
      support: "emulated",
      helper: "uf<Component><Slot>",
      note: "A forwarded named slot re-declares the child's slot template under `@if`, with the parent's template as its content (ADR-0056).",
    },
    model: { support: "native" },
    "two-way-binding": { support: "native" },
    "model-array": {
      support: "emulated",
      helper: "toggle",
      note: "A checkbox group's array goes through an inline helper, `toggle`, and a multiple select's through `selectedValues`, as Vue's `vModelCheckbox` and `vModelSelect` do (ADR-0054).",
    },
    "model-modifiers": {
      support: "emulated",
      helper: "modelText",
      note: "A `v-model`'s modifiers and a number control's cast follow Vue's `vModelText` through an inline helper, `modelText` (ADR-0054).",
    },
    fallthrough: {
      support: "emulated",
      helper: "fallthrough",
      note: "A component that inherits `class` and `style` declares them as inputs, merges them into its root element and clears them from its host, which keeps only `display: contents` (ADR-0056).",
    },
    "contextual-root": {
      support: "unsupported",
      code: "UF4001",
      severity: "error",
      reason:
        "A root element HTML or ARIA ties to its parent (`li`, `tr`, `option`, …) renders inside Angular's host element, which breaks the parent's content model: axe reports `list` and `listitem`, and the HTML parser moves a host out of a table (ADR-0056).",
    },
    expose: { support: "native" },
    context: { support: "native" },
    "reactive-context": {
      support: "emulated",
      helper: "refObject",
      note: "A provided ref is passed as an object with a `value` getter, `refObject`, which descendants read as it changes (ADR-0054).",
    },
    "dynamic-component": {
      support: "emulated",
      helper: "@switch",
      note: "Angular has no `<component is>` over a known set in a strict template: an `@switch` renders each candidate (ADR-0054).",
    },
  },
  emit(component: UfComponent, context: EmitContext): OutputFile[] {
    // Composition's cells are declared before this target emits it (ADR-0055): until M3's lane
    // for Angular lands, a component that uses it is reported, never emitted without it (P2).
    const composition = compositionUse(context.module, component);
    if (composition) {
      context.report({
        code: "UF1002",
        severity: "error",
        message: `The angular target does not emit ${composition.what} yet: composition lands in M3.`,
        span: composition.span,
      });
      return [];
    }
    return [emitComponent(component, context.module)];
  },
});

export default angular;

/** A component's output file. */
function emitComponent(component: UfComponent, module: UfModule): OutputFile {
  const plan = planComponent(component, module);
  const { imports } = plan;
  // The module's types keep their names, which consumers import. Angular's own names come
  // next: its compiler accepts a signal input only in a class whose decorator is imported as
  // `Component` (NG8110 otherwise), so a component named `Component` takes another name
  // locally (`Component_1`), exported under its own.
  const decoratorName = imports.add("@angular/core", "Component");
  const className = imports.claim(component.name);
  const placeholders = new Placeholders();

  const callsNextTick = codeOf(component).some(({ code }) =>
    code.refs.some((reference) => reference.kind === "Api"),
  );
  const nextTick = callsNextTick ? plan.members.claim("nextTick") : undefined;
  const rules = classRules(plan, nextTick);
  const closure = componentTypes(component, module);
  const listeners = planListeners(plan, nextTick);
  const reads = templateReads(plan, listeners);
  const templateMembers = new Set<string>(
    [...reads.read, ...reads.keyed, ...listeners.members].map((id) => bindingById(plan, id).name),
  );
  for (const method of listeners.methods) templateMembers.add(method.name);
  for (const guard of listeners.guards) templateMembers.add(guard);
  const nextId = component.setup.some((item) => item.kind === "Id")
    ? imports.claim("nextId")
    : undefined;
  const directives = listeners.directives.map((spec) => directiveCode(spec, imports, placeholders));
  const { members, implements: interfaces } = classMembers({
    plan,
    placeholders,
    declarations: closure,
    rules,
    templateMembers,
    globals: reads.globals,
    handlers: listeners.methods,
    guards: listeners.guards,
    ...(listeners.once === undefined ? {} : { once: listeners.once }),
    ...(nextTick === undefined ? {} : { nextTick }),
    ...(nextId === undefined ? {} : { nextId }),
  });

  type Entry = Parameters<typeof js.objectExpression>[0][number];
  const metadata = js.objectExpression([
    ["selector", js.stringLiteral(`uf-${kebabCase(component.name)}`)],
    ...(directives.length
      ? [
          [
            "imports",
            js.arrayExpression(
              listeners.directives.map(({ className: name }) => js.identifier(name)),
            ),
          ] satisfies Entry,
        ]
      : []),
    ["host", js.objectExpression([["style", js.stringLiteral("display: contents")]])],
    ["preserveWhitespaces", js.booleanLiteral(false)],
    ["template", js.templateLiteral(`\n${template(plan, listeners, reads)}\n  `)],
  ]);
  // Printed apart from the class: oxc-codegen puts a class's decorators after `export`, and
  // Angular code puts them first.
  const decorator = `@${printExpression(js.callExpression(js.identifier(decoratorName), [metadata]))}`;
  const statements = exportDeclaration(
    className,
    js.classDeclaration(className, [], members, { implements: interfaces }),
    exportsOf(component.name, module.exports),
  );
  const types = declaredTypes(closure, typeRoots(component, module));
  const contents = placeholders.print(() =>
    [
      printProgram(js.program(imports.toDeclarations())),
      ...types.map((declaration) => `${typeDeclarationCode(declaration)}\n`),
      ...(nextId === undefined ? [] : [`let ${nextId} = 0;\n`]),
      ...directives.map(
        ({ decorator: written, statements: declared }) =>
          `${written}\n${spaced(printProgram(js.program(declared)))}`,
      ),
      decorator,
      spaced(printProgram(js.program(statements))),
    ].join("\n"),
  );
  return { path: `${kebabCase(component.name)}.ts`, contents };
}

/**
 * The names of the types the output reads: its inputs' and outputs' types, and every name the
 * setup's code, annotations and functions read (`ref<Item[]>`, `as Item`, `(item: Item)`). The
 * props type itself is never printed: an input is typed by its member.
 */
function typeRoots(component: UfComponent, module: UfModule): Set<string> {
  const names = new Set<string>();
  const add = (found: Iterable<string>) => {
    for (const name of found) names.add(name);
  };
  const declared = new Set(module.types.map(({ name }) => name));
  for (const prop of component.props) add(typeNames(prop.type));
  for (const event of component.emits?.events ?? []) {
    for (const parameter of event.parameters) add(typeNames(parameter.type));
  }
  for (const item of component.setup) {
    if ("type" in item && item.type) add(typeNames(item.type));
  }
  for (const { code } of codeOf(component)) add(codeNames(code.code, codeKind(code, component)));
  for (const { function: fn } of functionsOf(component)) {
    for (const parameter of fn.parameters) if (parameter.type) add(typeNames(parameter.type));
    if (fn.returnType) add(typeNames(fn.returnType));
  }
  return new Set([...names].filter((name) => declared.has(name)));
}

/**
 * A printed class with a blank line before each of its methods, as Angular code sets them apart
 * from the fields and from each other (oxfmt keeps a blank line, and adds none). Read before the
 * placeholders are spliced: a member starts at the class's indentation, and a method's line ends
 * with its body's `{` where a field's holds ` = `.
 */
function spaced(printed: string): string {
  return printed.replace(/\n(?= {2}[^\s}][^\n]*\{\n)(?! {2}[^\n]* = )/g, "\n\n");
}
