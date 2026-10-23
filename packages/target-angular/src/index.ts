import {
  angularDialect,
  codeNames,
  codeKind,
  defineTarget,
  exportDeclaration,
  exportsOf,
  componentTypes,
  js,
  kebabCase,
  moduleHelperName,
  Placeholders,
  printExpression,
  printProgram,
  rewriteCode,
  scopeRoots,
  sourceNames,
  typeDeclarationCode,
  typeNames,
} from "@unframework/codegen";
import type {
  EmitContext,
  ImportSet,
  OutputFile,
  RewriteRules,
  Target,
} from "@unframework/codegen";
import { codeOf, functionsOf, walk } from "@unframework/ir";
import type { Span, UfComponent, UfModule } from "@unframework/ir";

import {
  firstUse,
  keyOf,
  planComposition,
  refObjectCode,
  slotDirectiveCode,
  tokenType,
} from "./composition.ts";
import type { Composition } from "./composition.ts";
import { directiveCode, scopeDirectiveCode } from "./directives.ts";
import type { ScopeDirectiveNames } from "./directives.ts";
import { planListeners } from "./listeners.ts";
import { classMembers } from "./members.ts";
import { planModels } from "./models.ts";
import { outputName } from "./outputs.ts";
import { ANGULAR_MEMBERS, bindingById, planComponent, slotQuery } from "./plan.ts";
import type { Plan } from "./plan.ts";
import { classRules } from "./rules.ts";
import { fallthroughRoot, template, templateReads } from "./template.ts";
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
    "class-binding": {
      support: "emulated",
      helper: "classNames",
      note: "Angular's `[class]` reads no nested array, and drops an entry that holds a space, so a class part that may be an array or an object goes through an inline helper, `classNames`, that reads it as Vue's `normalizeClass` does (ADR-0065).",
    },
    "style-binding": {
      support: "emulated",
      helper: "styleObject",
      note: "A style bound to a value is Angular's own `[style]`, but where an object spread merges it, on the root that takes a consumer's style and on a component, an inline helper splits a declaration list into an object as Vue does (ADR-0065).",
    },
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
    "scoped-styles": { support: "native" },
    // The child's root takes the `data-uf-*` attributes its styled parents put on its host
    // through `[ufScope]` (ADR-0063), but it renders inside the host, which selectors see.
    "child-root-scope": {
      support: "unsupported",
      code: "UF4003",
      severity: "info",
      reason:
        "Each root node of a child binds an inline attribute directive, `[ufScope]`, that moves the scope attributes its styled parents put on its host onto the node, so their rules reach it. But the root renders inside its host element, which selectors see: a parent's rule that reaches the root through a combinator (`>`, `+`, `~`) or a structural pseudo-class (`:first-child`, `:nth-child()`, …) matches the host's place, not the root's, and may match differently. A root Angular binds nothing on (`{{` in an attribute, ADR-0037) takes no scope attribute.",
    },
    "slotted-styles": { support: "native" },
    // Sheets cascade in render order, not Vue's import order (ADR-0063): declared, since a
    // parent sees too little of its subtree to attach its sheets in Vue's order.
    "sheet-order": {
      support: "unsupported",
      code: "UF4002",
      severity: "info",
      reason:
        "Angular adds a component's sheet to the page when the component first renders (`styleUrl`, through `SharedStylesHost`): a parent's before its children's, and siblings in the order they render, where Vue loads them in import order, a child's first. Where two sheets' rules of equal specificity meet on one element (a child's root, content filled into a slot, `:deep()`, `:global()`), the winner can differ.",
    },
  },
  emit(component: UfComponent, context: EmitContext): OutputFile[] {
    return [emitComponent(component, context)];
  },
});

export default angular;

/** A component's output file. */
function emitComponent(component: UfComponent, context: EmitContext): OutputFile {
  const { module } = context;
  const plan = planComponent(component, module);
  const { imports } = plan;
  const composition = planComposition(plan);
  // Angular matches a child by its selector alone, so two children of one name are reported
  // (UF1104), as two names that differ only in case are: rename one of them.
  for (const [local, selector] of composition.clashes) {
    context.report({
      code: "UF1104",
      severity: "error",
      message: `\`${local}\` is written \`<${selector}>\` on Angular, as another component of its name is: Angular would match both. Rename one of them.`,
      span: firstUse(component, local),
    });
  }
  // A slot's directive selects its component's name and the slot's: two pairs can give one
  // attribute (UF1104), so a template that fills both slots would match both directives.
  for (const { fill, child, attribute, other } of composition.slotClashes) {
    context.report({
      code: "UF1104",
      severity: "error",
      message: `${child} is filled through \`${attribute}\` on Angular, as ${other} is: Angular would match both. Rename one of the slots.`,
      span: fill.span,
    });
  }
  const models = planModels(plan);
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
  const listeners = planListeners(plan, nextTick, models.writes);
  const reads = templateReads(plan, listeners);
  const templateMembers = new Set<string>(
    [...reads.read, ...reads.keyed, ...listeners.members].map((id) => bindingById(plan, id).name),
  );
  for (const method of listeners.methods) templateMembers.add(method.name);
  for (const guard of listeners.guards) templateMembers.add(guard);
  for (const slot of reads.slots) templateMembers.add(slotQuery(slot));
  // A consumer's `class` and `style` fall through to a root element or component, through
  // inputs; the host clears both for a component that takes them or opts out (ADR-0056).
  // A root Angular can bind nothing on (`{{` in an attribute, ADR-0037) takes neither.
  const root = fallthroughRoot(component.render);
  const fallthrough =
    component.inheritAttrs !== false &&
    root !== undefined &&
    (root.kind === "Component" || angularDialect.literalRegion?.(root) === undefined);
  const clearsHost = fallthrough || component.inheritAttrs === false;
  reportApiClashes(component, composition, fallthrough, context);
  const usesRefObject = component.setup.some(
    (item) =>
      (item.kind === "Provide" || (item.kind === "Inject" && item.fallback)) &&
      keyOf(plan, item.key).ref,
  );
  const refObject = usesRefObject ? imports.claim("refObject") : undefined;
  const provided = providers(plan, rules, composition, className, refObject);
  const nextId = component.setup.some((item) => item.kind === "Id")
    ? imports.claim("nextId")
    : undefined;
  const directives = listeners.directives.map((spec) => directiveCode(spec, imports, placeholders));
  // The child-root rule (ADR-0063): each root node binds the directive that gives it the scope
  // attributes the component's styled parents put on its host.
  const roots = scopedRoots(component);
  const scope = roots.size
    ? { ...scopeNames(component, module, imports), host: plan.members.claim("host") }
    : undefined;
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
    ...(refObject === undefined ? {} : { refObject }),
    slots: composition.slots,
    fallthrough,
    keyNames: composition.keyNames,
    external: provided.external,
    helpers: models.helpers,
    ...(models.server === undefined ? {} : { server: models.server }),
  });

  type Entry = Parameters<typeof js.objectExpression>[0][number];
  const metadata = js.objectExpression([
    ["selector", js.stringLiteral(`uf-${kebabCase(component.name)}`)],
    ...(composition.imports.length || directives.length || scope
      ? [
          [
            "imports",
            js.arrayExpression(
              [
                ...composition.imports,
                ...listeners.directives.map(({ className: name }) => name),
                ...(scope ? [scope.className] : []),
              ].map((name) => js.identifier(name)),
            ),
          ] satisfies Entry,
        ]
      : []),
    ...(provided.code.length
      ? [
          [
            "providers",
            js.arrayExpression(provided.code.map((code) => placeholders.expression(code))),
          ] satisfies Entry,
        ]
      : []),
    [
      "host",
      clearsHost
        ? js.objectExpression([
            ["[attr.class]", js.stringLiteral("null")],
            ["[attr.style]", js.stringLiteral("'display: contents;'")],
          ])
        : js.objectExpression([["style", js.stringLiteral("display: contents")]]),
    ],
    ["preserveWhitespaces", js.booleanLiteral(false)],
    [
      "template",
      js.templateLiteral(
        `\n${template(plan, listeners, reads, composition, models, fallthrough, scope && { roots, host: scope.host })}\n  `,
      ),
    ],
    // The sheet `compile()` emits beside the source, already scoped (ADR-0063): Angular's own
    // encapsulation would scope it again.
    ...(component.styles
      ? [
          [
            "styleUrl",
            js.stringLiteral(`./${module.file.slice(module.file.lastIndexOf("/") + 1)}.css`),
          ] satisfies Entry,
          [
            "encapsulation",
            js.memberExpression(
              js.identifier(imports.add("@angular/core", "ViewEncapsulation")),
              "None",
            ),
          ] satisfies Entry,
        ]
      : []),
  ]);
  // Printed apart from the class: oxc-codegen puts a class's decorators after `export`, and
  // Angular code puts them first.
  const decorator = () =>
    `@${printExpression(js.callExpression(js.identifier(decoratorName), [metadata]))}`;
  // The host the root nodes' scope directive reads (`<button [ufScope]="this.host">`).
  const hostMember = scope && [
    js.propertyDefinition(
      scope.host,
      placeholders.expression(
        `${imports.add("@angular/core", "inject")}<${imports.add("@angular/core", "ElementRef")}<HTMLElement>>(${imports.add("@angular/core", "ElementRef")}).nativeElement`,
      ),
      { accessibility: "protected", readonly: true },
    ),
  ];
  const statements = exportDeclaration(
    className,
    js.classDeclaration(className, [], [...members, ...(hostMember ?? [])], {
      implements: interfaces,
    }),
    exportsOf(component.name, module.exports),
  );
  const types = declaredTypes(closure, typeRoots(component, module));
  // A slot's directive is exported under the name its consumers compute (`CardTitle`), which
  // nothing else the file exports may take: a type, a key or the component (UF2003).
  const exported = new Map<string, string>([
    ...types.filter((type) => type.exported).map(({ name }) => [name, `the type`] as const),
    ...composition.keys.map(({ name }) => [name, `the injection key`] as const),
    ...exportsOf(component.name, module.exports).map(
      ({ name }) => [name, `the component`] as const,
    ),
  ]);
  for (const { slot, exported: name } of composition.slots) {
    const other = exported.get(name);
    if (other === undefined) continue;
    context.report({
      code: "UF2003",
      severity: "error",
      message: `\`${name}\` names the directive of \`${component.name}\`'s \`${slot.name}\` slot on Angular, and ${other} \`${name}\` too. Rename one of them.`,
      span: slot.span,
    });
  }
  // The file's own declarations, before the imports print: each adds the imports it needs.
  const declarations = [
    ...composition.keys.map(
      (key) =>
        `export const ${key.name} = new ${imports.add("@angular/core", "InjectionToken")}<${tokenType(key)}>(${JSON.stringify(key.description)});\n`,
    ),
    ...(refObject === undefined ? [] : [refObjectCode(refObject)]),
    ...[...models.helpers, ...models.support].map(({ code }) => `${code}\n`),
    ...composition.slots.map((slot) =>
      slotDirectiveCode(component.name, slot, imports.add("@angular/core", "Directive")),
    ),
    ...(scope ? [scopeDirectiveCode(scope, imports)] : []),
  ];
  if (models.helpers.some(({ code }) => code.includes("WritableSignal"))) {
    imports.add("@angular/core", "WritableSignal", { type: true });
  }
  const contents = placeholders.print(() =>
    [
      printProgram(js.program(imports.toDeclarations())),
      ...types.map((declaration) => `${typeDeclarationCode(declaration)}\n`),
      ...(nextId === undefined ? [] : [`let ${nextId} = 0;\n`]),
      ...declarations,
      ...directives.map(
        ({ decorator: written, statements: declared }) =>
          `${written}\n${spaced(printProgram(js.program(declared)))}`,
      ),
      decorator(),
      spaced(printProgram(js.program(statements))),
    ].join("\n"),
  );
  return { path: `${kebabCase(component.name)}.ts`, contents };
}

/** A span's key in a set of root nodes. */
function spanKey({ start, end }: Span): string {
  return `${start}:${end}`;
}

/**
 * The component's root nodes that take its styled parents' scope attributes (`scopeRoots`, the
 * child-root rule, ADR-0063), by {@link spanKey}: all but an element Angular binds nothing on
 * (`{{` in an attribute, ADR-0037), which takes no fallthrough either.
 */
function scopedRoots(component: UfComponent): Set<string> {
  const roots = new Set(scopeRoots(component).map(spanKey));
  walk(component.render, {
    enter(node) {
      if (node.kind === "Element" && angularDialect.literalRegion?.(node) !== undefined) {
        roots.delete(spanKey(node.span));
      }
    },
  });
  return roots;
}

/**
 * The names of the scope directive's code. A source's components are joined into one module
 * where it is loaded (ADR-0053): each claims them from bases of its own (`ScopeAttributes_1`),
 * past the names any other component declares.
 */
function scopeNames(
  component: UfComponent,
  module: UfModule,
  imports: ImportSet,
): ScopeDirectiveNames {
  const index = module.components.findIndex((each) => each.name === component.name);
  const reserved = module.components.map((each) => sourceNames(each, module));
  const claim = (helper: string) => {
    const { base, others } = moduleHelperName(helper, reserved, index);
    imports.reserve(...others);
    imports.scope.rebase(helper, base);
    return imports.claim(helper);
  };
  return { className: claim("ScopeAttributes"), scopes: claim("scopes") };
}

/** A name of the component's API on Angular, and what the source names with it. */
interface ApiName {
  /** A class member, an input or an output. */
  space: "member" | "input" | "output";
  name: string;
  /** What declares it, for a diagnostic: "the prop `label`". */
  what: string;
}

/**
 * Reports each name of the component's API that another name of it takes on Angular (UF2003).
 * Angular declares a class member for each prop, output, exposed function, slot query and
 * lifecycle hook, and names each input and output in a consumer's template: a model's own name
 * and its `Change` output (`value`, `valueChange`), and an event's output name (`ufChange` for
 * `change`). The source's names are the component's API, which the target keeps as they are,
 * so a clash is reported at the later declaration rather than renamed. A binding is no API:
 * ./plan.ts renames it.
 */
function reportApiClashes(
  component: UfComponent,
  composition: Composition,
  fallthrough: boolean,
  context: EmitContext,
): void {
  const taken = new Map<string, string>();
  const key = ({ space, name }: ApiName) => `${space} ${name}`;
  const declare = (names: ApiName[]) => {
    for (const name of names) if (!taken.has(key(name))) taken.set(key(name), name.what);
  };
  for (const name of ANGULAR_MEMBERS) {
    const what =
      name === "constructor" ? "the class's constructor" : `the lifecycle hook \`${name}\``;
    declare([{ space: "member", name, what }]);
  }
  for (const { slot } of composition.slots) {
    const what = `the query of the \`${slot.name}\` slot`;
    declare([{ space: "member", name: slotQuery(slot.name), what }]);
  }
  if (fallthrough) {
    for (const name of ["class", "style"]) {
      const what = `the input of the consumer's \`${name}\``;
      declare([
        { space: "member", name, what },
        { space: "input", name, what },
      ]);
    }
  }
  const source: { kind: string; label: string; span: Span; names: ApiName[] }[] = [
    ...component.props.map(({ name, span }) => {
      const what = `the prop \`${name}\``;
      return {
        kind: "prop",
        label: name,
        span,
        names: [
          { space: "member" as const, name, what },
          { space: "input" as const, name, what },
        ],
      };
    }),
    ...component.setup.flatMap((item) =>
      item.kind === "Model"
        ? [
            {
              kind: "model",
              label: item.name,
              span: item.span,
              names: [
                { space: "input" as const, name: item.name, what: `the model \`${item.name}\`` },
                {
                  space: "output" as const,
                  name: `${item.name}Change`,
                  what: `the output of the model \`${item.name}\``,
                },
              ],
            },
          ]
        : [],
    ),
    ...(component.emits?.events ?? []).map(({ name: event, span }) => {
      const name = outputName(event);
      const what =
        name === event
          ? `the output of the event \`${event}\``
          : `the output \`${name}\` of the event \`${event}\``;
      return {
        kind: "event",
        label: event,
        span,
        names: [
          { space: "member" as const, name, what },
          { space: "output" as const, name, what },
        ],
      };
    }),
    ...(component.exposes?.functions ?? []).map((id) => {
      const { name, span } = component.bindings.find((binding) => binding.id === id)!;
      return {
        kind: "function",
        label: name,
        span,
        names: [{ space: "member" as const, name, what: `the exposed function \`${name}\`` }],
      };
    }),
  ];
  for (const { kind, label, span, names } of source) {
    const clash = names.find((name) => taken.has(key(name)));
    if (clash === undefined) {
      declare(names);
      continue;
    }
    const named = clash.name === label ? `\`${label}\`` : `\`${clash.name}\`, ${clash.what},`;
    context.report({
      code: "UF2003",
      severity: "error",
      message: `${named} names ${taken.get(key(clash))} on Angular. Rename the ${kind}.`,
      span,
    });
  }
}

/**
 * A provider per key the setup provides (ADR-0054): the value itself where it reads nothing of
 * the component (`useValue`), or a factory that reads it from the component's instance, which a
 * descendant's injector creates once the inputs are set; a key of a ref gets `refObject` over the
 * signal. The members the factories read are public: they are read from outside the class.
 */
function providers(
  plan: Plan,
  rules: RewriteRules,
  composition: Composition,
  className: string,
  refObject: string | undefined,
): { code: string[]; external: Set<string> } {
  const external = new Set<string>();
  const code: string[] = [];
  const instance = plan.locals.claim(`${className.charAt(0).toLowerCase()}${className.slice(1)}`);
  for (const item of plan.component.setup) {
    if (item.kind !== "Provide") continue;
    for (const reference of item.value.refs) {
      if (reference.kind === "Binding") external.add(bindingById(plan, reference.binding).name);
    }
    const written = rewriteCode(item.value, plan.component, rules, "pure");
    const value = keyOf(plan, item.key).ref ? `${refObject}(${written})` : written;
    const key = composition.keyNames.get(item.key) ?? item.key;
    const reads = value.split("this.").length - 1;
    const inject = () => `${plan.imports.add("@angular/core", "inject")}(${className})`;
    code.push(
      reads === 0
        ? `{ provide: ${key}, useValue: ${value} }`
        : reads === 1
          ? `{ provide: ${key}, useFactory: () => ${value.replace("this.", `${inject()}.`)} }`
          : `{ provide: ${key}, useFactory: () => { const ${instance} = ${inject()}; return ${value.replaceAll("this.", `${instance}.`)}; } }`,
    );
  }
  return { code, external };
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
