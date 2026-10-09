import {
  angularLowercases,
  angularMisreads,
  cssPropertiesOverlap,
  cssValueProblem,
  isCssPropertyName,
  isKnownCssProperty,
} from "./css.ts";
import {
  DOM_EVENTS,
  EVENT_INTERFACES,
  EVENT_METHODS,
  extendsEventInterface,
  PASSIVE_EVENTS,
  PORTABLE_EVENT_INTERFACES,
  PORTABLE_EVENT_MEMBERS,
  UNSUPPORTED_EVENTS,
  WINDOW_EVENTS,
} from "./events.ts";
import {
  BINDABLE_BOOLEAN_ATTRIBUTES,
  canonicalNumber,
  DOCUMENT_ATTRIBUTES,
  isBooleanAttribute,
  isHtmlAttribute,
  isHtmlElement,
  isNumberTypedAttribute,
  isVoidElement,
  NUMERIC_ATTRIBUTES,
  TEXT_ONLY_ELEMENTS,
  unanalysableUrl,
  unkeptCharacter,
  UNRENDERABLE_ELEMENTS,
} from "./html.ts";
import {
  ALLOWED_GLOBALS,
  BROWSER_GLOBALS,
  CLIENT_GLOBALS,
  isComponentName,
  isExportName,
  isIdentifier,
  PURE_GLOBALS,
  readsDom,
  RESERVED_TYPE_NAMES,
  reservedEventName,
  reservedParameterName,
  reservedPropName,
  reservedPropsParameterName,
  reservedSetupName,
  SCHEDULING_GLOBALS,
} from "./names.ts";
import {
  CHILDLESS_ATTRIBUTES,
  isDroppedEmptyUrl,
  isStateAttribute,
  isWhitespaceText,
  LEADING_LINE_FEED_ELEMENTS,
  RAW_TEXT_ELEMENTS,
  TEMPLATE_SYNTAX_ATTRIBUTES,
  unbindableAttribute,
  undeclaredAttribute,
  UNINTERPOLATED_ELEMENTS,
  UNPORTABLE_ELEMENTS,
  UNRENDERED_ATTRIBUTES,
  WHITESPACE_DROPPING_ELEMENTS,
} from "./portability.ts";
import { impurity, summarize, summarizeCode, summarizeTracked } from "./summary.ts";
import type { CodeSummary, FunctionSummary } from "./summary.ts";
import {
  elementNamespace,
  isSvgAttribute,
  isSvgElement,
  SVG_HTML_INTEGRATION_POINTS,
  SVG_TEXT_ELEMENTS,
  SVG_UNRENDERABLE_ELEMENTS,
  SVG_WHITESPACE_KEEPING_ELEMENT,
} from "./svg.ts";
import type { Namespace } from "./svg.ts";
import type {
  Attribute,
  Binding,
  BindingId,
  BindingKind,
  BindingReference,
  ClassAttribute,
  Code,
  ComponentAttribute,
  ComponentNode,
  DynamicNode,
  ElementNode,
  Emits,
  EventAttribute,
  Expression,
  FunctionCode,
  FunctionItem,
  Handler,
  IfNode,
  ModelAttribute,
  Parameter,
  RefAttribute,
  RenderNode,
  SetupItem,
  SlotFill,
  SlotOutletNode,
  SlotReference,
  Span,
  StyleAttribute,
  UfComponent,
  UfModule,
  WriteReference,
} from "./types.ts";
import type { IrValidationError } from "./validate.ts";
import type { FunctionRole } from "./visit.ts";

/**
 * A `class` in canonical form: one or more names, separated by single spaces, and no other
 * whitespace (JavaScript's `\s`, which Angular splits names at).
 */
const CANONICAL_CLASS = /^\S+(?: \S+)*$/u;

/**
 * Checks the invariants of a schema-valid module that its JSON Schema cannot express, which
 * the types document and every target relies on to render the same DOM, and to copy no code
 * through:
 * - each component's name is PascalCase and differs from the others' by more than case, since
 *   it names a class and a file; each export is `default` or an identifier, of a component,
 *   once;
 * - each element is an HTML element every target can render as itself, or inside an `<svg>` an
 *   SVG element (ADR-0040), and a void one has no children;
 * - each rendered attribute is an attribute of its element (so no `on*` handler, `key` or `ref`:
 *   listeners and template refs are attributes of their own kinds), set once across every kind
 *   and spread key (a spread's `class` merges with the element's), and none that a target
 *   renders differently (`portability.ts`): template syntax, attributes a framework acts on or
 *   sets as state, `contenteditable` with children, an empty URL React drops, a number in a
 *   form renderers rewrite, a boolean or an attribute a target cannot bind (ADR-0037);
 * - `true` is the value of exactly the HTML boolean attributes, a `class` is canonical and names
 *   each class once, and a `style` sets each property once, without overlap, with custom
 *   properties in lower case and static values Angular's style parser reads as written
 *   (ADR-0038);
 * - no value holds code or a document the compiler cannot analyse (`srcdoc`, a `javascript:`
 *   URL, a `data:` URL a frame loads), and text and values hold only characters HTML keeps;
 * - text sits where every target renders it alike: no whitespace-only text where Svelte drops
 *   it, no interpolation where the parser moves or drops text, no text but whitespace and no
 *   conditional in a raw-text `<iframe>`, no line feed the parser drops at the start of a
 *   `<pre>`, after what may render nothing included, never two texts side by side;
 * - props have names every target can declare, static defaults, and one binding each, and the
 *   object form's parameter a name no framework declares; a local `Props` is the props type of
 *   every component whose props reach it; every binding's id is its name and offset, and no two
 *   of a component's own bindings (props, the setup's and `emit`) share a name;
 * - the setup's items come in source order, inside the component and before its render; each
 *   declares one binding of its kind (ADR-0045), whose name no target reserves; the `emit`
 *   binding is the one `emits` declares, whose events have names every target can spell apart
 *   and payloads of named members (ADR-0047);
 * - every expression and piece of code is its source text, and refers only to bindings in scope
 *   there and to the globals its context may read: a prop by name or, in the object form, as the
 *   parameter's member, and a `ref`'s, a `computed`'s or a template ref's value as `name.value`
 *   (ADR-0034, ADR-0035, ADR-0045). Its references are in order and apart, but a write's value's
 *   and an emit's arguments', which follow it; a narrowed path of a read starts at the read of a
 *   prop or a ref's value, ends at it or at a member path off it, written with `.` and literal
 *   keys, longer than the one before, and is narrowed in the template only where it is code's,
 *   and across a closure only as a destructured prop's own read (ADR-0046);
 * - code runs where it may (ADR-0045): a template's expressions and the setup's initial values
 *   and getters read no template ref, setup `let` or `emit`, write nothing, emit nothing and call
 *   only local functions whose summary is pure, and a getter only those that read static values;
 *   only client code writes a `state` or `localVar`, emits a declared event with as many
 *   arguments as it takes, calls `nextTick` and reads a local function as a value; what the setup
 *   evaluates reads only what is declared before it; an immediate watcher's callback is safe on
 *   the server, a watcher that is not `post` reads no DOM before `await nextTick()`, and
 *   `watchEffect` reads nothing that is not reactive (ADR-0048);
 * - functions have the parameters their role takes, named apart from the component's names, with
 *   static defaults, and a block or an expression body as their flag says; a handler's event
 *   parameter has an interface of its event, and the code uses only its portable members, and
 *   lists its leading `preventDefault()` and `stopPropagation()` calls, each holding its call, with
 *   a condition that reads only the event (ADR-0047);
 * - each listener takes an event of the vocabulary (`events.ts`), at most one option, `passive`
 *   only where it counts, a local function or a function in place, once per event and options
 *   on its element; each template ref is attached by one element outside any list (ADR-0049);
 *   neither sits in Angular's literal region, which binds nothing (ADR-0037);
 * - conditionals, lists and fragments have the shapes the targets print; a loop variable takes
 *   no name a target's rewrite or an output would capture, and a key reads its list's item or
 *   index and no loop variable of a list around it (ADR-0035, ADR-0036);
 * - composition (ADR-0055): a component element names exactly one imported or local component,
 *   and each prop, listener, model and fill names a declaration of its API; a fill forwards a
 *   slot the component declares, with no children; a slot outlet and a slot's presence name a
 *   slot the component declares; a model's binding, a component's or an element's, is a `state`
 *   or `model` binding's `.value`; a `context` binding is never written; a scoped fill's names
 *   are in scope in it alone; and a `Dynamic` node's candidates are all tags, with element
 *   attributes and children, or all components, with component attributes and fills that every
 *   candidate declares.
 *
 * The analyser's IR keeps them by construction, and the compiler checks every module it emits
 * from, a plugin's included. What else the analyser rejects is authoring, which a plugin owns
 * as it owns what its `output` hook writes: how JSX reads text, the names the compiler and the
 * frameworks reserve (`data-uf-*`, `uf-id-`, `data-hk`, `nonce`), nesting the parser repairs,
 * and attributes that are valid but mean nothing where they are written. An expression's code
 * is JavaScript the IR cannot parse: the compiler compares a plugin's with the analyser's, and
 * what only the syntax shows (a write that is not a statement, a mutation, a conditional read in
 * an effect, nondeterminism) is the analyser's. Nor does the IR know a value's type, so a
 * spread's `nullish` is the analyser's to set: a plugin that moves a spread keeps it true
 * wherever the object may be nullish (ADR-0039).
 */
export function checkInvariants(module: UfModule): IrValidationError[] {
  const errors: IrValidationError[] = [];
  const types = checkTypeDeclarations(module, errors);
  const apis = componentApis(module, errors);
  // The keys `provide` and `inject` may name: the module's own, and the imported ones, each with
  // whether it holds a ref.
  const keys = new Map<string, boolean>([
    ...(module.keys ?? []).map(({ name, type }) => [name, holdsRef(type.code)] as const),
    ...(module.imports ?? []).flatMap((entry) =>
      entry.names.flatMap(({ kind, imported, local }) =>
        kind === "Key"
          ? [
              [
                local,
                holdsRef(entry.api.keys.find((key) => key.name === imported)?.type ?? ""),
              ] as const,
            ]
          : [],
      ),
    ),
  ]);
  const components = new Set<string>();
  // Each name names a file, and case-insensitive file systems merge two that differ in case.
  const byFile = new Map<string, string>();
  for (const [index, component] of module.components.entries()) {
    const path = `/components/${index}`;
    const { name } = component;
    if (!isComponentName(name)) {
      errors.push({
        path: `${path}/name`,
        message: `must be PascalCase, in ASCII letters and digits, and "${name}" is not`,
      });
    }
    const other = byFile.get(name.toLowerCase());
    if (other !== undefined) {
      errors.push({
        path: `${path}/name`,
        message:
          other === name
            ? `must differ from the other components' names, and "${name}" does not`
            : `must differ from "${other}" by more than case, as each names a file`,
      });
    } else {
      byFile.set(name.toLowerCase(), name);
    }
    components.add(name);
    checkComponent(component, path, types, apis, keys, errors);
  }
  const exported = new Set<string>();
  for (const [index, entry] of module.exports.entries()) {
    const path = `/exports/${index}`;
    if (!components.has(entry.local)) {
      errors.push({
        path: `${path}/local`,
        message: `must name a component of the module, and "${entry.local}" is not one`,
      });
    }
    if (!isExportName(entry.name)) {
      errors.push({
        path: `${path}/name`,
        message: `must be "default" or an identifier, and "${entry.name}" is not`,
      });
    } else if ((entry.kind === "default") !== (entry.name === "default")) {
      errors.push({
        path: `${path}/kind`,
        message:
          entry.kind === "default"
            ? `must be "named" for an export named "${entry.name}"`
            : 'must be "default" for the export named "default"',
      });
    }
    if (exported.has(entry.name)) {
      errors.push({ path: `${path}/name`, message: `must export "${entry.name}" once` });
    }
    exported.add(entry.name);
  }
  return errors;
}

/** What a parent may pass a component: the names its API declares (ADR-0055). */
interface Declared {
  readonly props: ReadonlySet<string>;
  readonly events: ReadonlySet<string>;
  readonly models: ReadonlySet<string>;
  readonly slots: ReadonlySet<string>;
}

/**
 * The components a module's component elements may name, by local name: the module's own, and
 * the imported ones from their resolved APIs (ADR-0053). A name that names two is left out, so
 * an element that uses it names none, and reported.
 */
function componentApis(
  module: UfModule,
  errors: IrValidationError[],
): ReadonlyMap<string, Declared> {
  const apis = new Map<string, Declared>();
  for (const component of module.components) {
    apis.set(component.name, {
      props: new Set(component.props.map(({ name }) => name)),
      events: new Set(component.emits?.events.map(({ name }) => name)),
      models: new Set(
        component.setup.flatMap((item) => (item.kind === "Model" ? [item.name] : [])),
      ),
      slots: new Set(component.slots?.slots.map(({ name }) => name)),
    });
  }
  const ambiguous = new Set<string>();
  for (const [index, entry] of (module.imports ?? []).entries()) {
    for (const [position, imported] of entry.names.entries()) {
      const at = `/imports/${index}/names/${position}`;
      if (imported.kind === "Key") {
        if (!entry.api.keys.some(({ name }) => name === imported.imported)) {
          errors.push({
            path: `${at}/imported`,
            message: `must name an injection key "${entry.specifier}" exports, and "${imported.imported}" is not one`,
          });
        }
        continue;
      }
      const api = entry.api.components.find((component) =>
        imported.imported === "default"
          ? component.export === "default"
          : component.export === "named" && component.name === imported.imported,
      );
      if (!api) {
        errors.push({
          path: `${at}/imported`,
          message: `must name a component "${entry.specifier}" exports, and "${imported.imported}" is not one`,
        });
        continue;
      }
      if (apis.has(imported.local)) {
        errors.push({
          path: `${at}/local`,
          message: `must differ from every other component's name in the module, and "${imported.local}" does not`,
        });
        ambiguous.add(imported.local);
        continue;
      }
      apis.set(imported.local, {
        props: new Set(api.props.map(({ name }) => name)),
        events: new Set(api.events.map(({ name }) => name)),
        models: new Set(api.models.map(({ name }) => name)),
        slots: new Set(api.slots.map(({ name }) => name)),
      });
    }
  }
  for (const name of ambiguous) apis.delete(name);
  return apis;
}

/**
 * Checks the module's type declarations, which outputs copy as written: identifiers, each name
 * once (TypeScript merges two interfaces of one name, which the outputs would not), in source
 * order. Returns the index of each by name.
 */
function checkTypeDeclarations(
  module: UfModule,
  errors: IrValidationError[],
): ReadonlyMap<string, number> {
  const indices = new Map<string, number>();
  let previous: Span | undefined;
  // `Props` may be a component's own props type, which the outputs keep as it is, unless another
  // component's props reach it: Astro's output declares that component's own `Props` beside the
  // copied one, a duplicate or, for an interface, a silent merge.
  const ownProps =
    module.components.some(takesProps) &&
    module.components.every(
      (component) => takesProps(component) || !component.types.includes("Props"),
    );
  for (const [index, declaration] of module.types.entries()) {
    const path = `/types/${index}`;
    const { name } = declaration;
    const reserved = name === "Props" && ownProps ? undefined : RESERVED_TYPE_NAMES.get(name);
    if (!isIdentifier(name)) {
      errors.push({ path: `${path}/name`, message: `must be an identifier, and "${name}" is not` });
    } else if (indices.has(name)) {
      errors.push({ path: `${path}/name`, message: `must declare "${name}" once` });
    } else {
      // A reserved name is still the declaration the components name: one error, at the name.
      if (reserved) {
        errors.push({ path: `${path}/name`, message: `must not be "${name}": ${reserved}` });
      }
      indices.set(name, index);
    }
    checkSourceText(declaration, path, errors);
    if (previous && declaration.span.start < previous.end) {
      errors.push({ path: `${path}/span`, message: "must follow the declaration before it" });
    }
    previous = declaration.span;
  }
  return indices;
}

/** Whether a component's props type is `Props` itself, which no output declares again. */
function takesProps(component: UfComponent): boolean {
  return component.propsParameter?.type.code === "Props";
}

/**
 * Where code runs (ADR-0045): a template's expressions; what the setup evaluates, its initial
 * values and its getters (a getter calls only functions Qwik can hoist); and client code.
 */
type Context = "render" | "initial" | "getter" | "client";

/** What a component's walk shares: the component's bindings and what the walk finds. */
interface Walk {
  readonly errors: IrValidationError[];
  readonly component: UfComponent;
  readonly bindings: ReadonlyMap<BindingId, Binding>;
  /** The object form's parameter name, which a reference to a prop starts with. */
  readonly propsName: string | undefined;
  /**
   * The component's own names (props, setup bindings, `emit`), each with what declares it:
   * no loop variable or parameter may take one.
   */
  readonly names: ReadonlyMap<string, string>;
  /** How many lists declare each loop variable. */
  readonly loopVariables: Map<BindingId, number>;
  /** How many elements attach each template ref. */
  readonly attachments: Map<BindingId, number>;
  /** The summary of each local function. */
  readonly summaries: ReadonlyMap<BindingId, FunctionSummary>;
  /** The item that declares each local function. */
  readonly functions: ReadonlyMap<BindingId, FunctionItem>;
  /** The `const`s whose value reads no binding: all a getter's functions may read. */
  readonly staticConsts: ReadonlySet<BindingId>;
  /** The components a component element may name, by local name, with what they declare. */
  readonly apis: ReadonlyMap<string, Declared>;
  /**
   * The injection keys `provide` and `inject` may name, by local name, with whether each holds a
   * ref (`InjectionKey<Ref<number>>`), which is provided whole and injected as a ref.
   */
  readonly keys: ReadonlyMap<string, boolean>;
}

/** Where a node sits: what the walk carries down the tree. */
interface Place {
  /** A JSON Pointer to the node. */
  readonly path: string;
  /** The nearest element: the node's parent in the DOM, or `undefined` at the component's root. */
  readonly element: ElementNode | undefined;
  /** The namespace of the nearest element's children. */
  readonly namespace: Namespace;
  /** Whether the node is inside an SVG `<text>`. */
  readonly inSvgText: boolean;
  /** Whether a conditional or a list lies between the node and the nearest element. */
  readonly controlled: boolean;
  /** Whether the node is inside a list's body. */
  readonly inList: boolean;
  /**
   * Whether the node is in Angular's literal region: in or inside an element with a static
   * attribute holding `{{`, which Angular prints in `ngNonBindable`, where nothing binds.
   */
  readonly literal: boolean;
  /** The bindings in scope: the component's, and the loop variables of the lists around the node. */
  readonly scope: ReadonlySet<BindingId>;
}

/** The binding kind each setup item declares. */
const ITEM_BINDINGS: Readonly<Record<SetupItem["kind"], BindingKind | undefined>> = {
  State: "state",
  Derived: "derived",
  TemplateRef: "templateRef",
  Id: "localConst",
  Const: "localConst",
  Variable: "localVar",
  Function: "localFn",
  Watch: undefined,
  WatchEffect: undefined,
  Lifecycle: undefined,
  Model: "model",
  Provide: undefined,
  Inject: "context",
};

/** The binding kinds a setup item declares. */
const SETUP_KINDS: ReadonlySet<BindingKind> = new Set(
  Object.values(ITEM_BINDINGS).filter((kind) => kind !== undefined),
);

function checkComponent(
  component: UfComponent,
  path: string,
  types: ReadonlyMap<string, number>,
  apis: ReadonlyMap<string, Declared>,
  keys: ReadonlyMap<string, boolean>,
  errors: IrValidationError[],
): void {
  const bindings = checkBindings(component, path, errors);
  const walk: Walk = {
    errors,
    component,
    bindings,
    propsName:
      component.propsParameter?.form === "object" ? component.propsParameter.name : undefined,
    names: checkNames(component, path, bindings, errors),
    loopVariables: new Map(),
    attachments: new Map(),
    summaries: summarize(component),
    functions: new Map(
      component.setup.flatMap((item) =>
        item.kind === "Function" ? [[item.binding, item] as const] : [],
      ),
    ),
    staticConsts: new Set(
      component.setup.flatMap((item) =>
        item.kind === "Const" && !item.value.refs.some((ref) => ref.kind === "Binding")
          ? [item.binding]
          : [],
      ),
    ),
    apis,
    keys,
  };
  checkComponentTypes(component, path, types, errors);
  checkProps(component, path, walk);
  // Setup bindings are in scope everywhere in the component; loop variables only in their list,
  // and a scoped fill's names only in the fill.
  const scope = new Set(
    component.bindings
      .filter(({ kind }) => kind !== "loopVar" && kind !== "slotScope")
      .map(({ id }) => id),
  );
  checkSetup(component, path, scope, walk);
  checkEmits(component, path, walk);
  checkSlots(component, path, walk);
  checkExposes(component, path, walk);
  const root: Place = {
    path: `${path}/render`,
    element: undefined,
    namespace: "html",
    inSvgText: false,
    controlled: false,
    inList: false,
    literal: false,
    scope,
  };
  const { render } = component;
  if (render.kind === "Element") {
    checkElement(render, root, walk);
  } else {
    if (!render.children.length) {
      errors.push({ path: `${path}/render/children`, message: "must hold a root node" });
    }
    checkChildren(render.children, { ...root, path: `${path}/render/children` }, walk);
  }
  for (const [index, binding] of component.bindings.entries()) {
    if (binding.kind === "loopVar") {
      const lists = walk.loopVariables.get(binding.id) ?? 0;
      if (lists !== 1) {
        errors.push({
          path: `${path}/bindings/${index}`,
          message:
            lists === 0
              ? `must be the item or index of a list, and "${binding.id}" is not`
              : `must be the item or index of one list, and "${binding.id}" is of ${lists}`,
        });
      }
    } else if (binding.kind === "templateRef") {
      const elements = walk.attachments.get(binding.id) ?? 0;
      if (elements !== 1) {
        errors.push({
          path: `${path}/bindings/${index}`,
          message: `must be attached by the \`ref\` of one element, and "${binding.id}" is by ${elements} (ADR-0049)`,
        });
      }
    }
  }
}

/**
 * Checks the names of a component's own bindings (props, setup bindings and `emit`), which every
 * target declares in one scope: none twice, none the object form's parameter's, and a setup
 * binding's none a target reserves (ADR-0045, UF2003). Returns what declares each name.
 */
function checkNames(
  component: UfComponent,
  path: string,
  bindings: ReadonlyMap<BindingId, Binding>,
  errors: IrValidationError[],
): ReadonlyMap<string, string> {
  const names = new Map<string, string>();
  for (const prop of component.props) names.set(prop.name, `the prop "${prop.name}"`);
  const parameter =
    component.propsParameter?.form === "object" ? component.propsParameter.name : undefined;
  for (const [index, binding] of component.bindings.entries()) {
    if (binding.kind === "prop" || binding.kind === "loopVar") continue;
    if (bindings.get(binding.id) !== binding) continue;
    const at = `${path}/bindings/${index}/name`;
    const reserved = reservedSetupName(binding.name);
    const taken = names.get(binding.name);
    if (reserved) {
      errors.push({ path: at, message: `must be a name every target can take: ${reserved}` });
    } else if (taken) {
      errors.push({
        path: at,
        message: `must differ from ${taken}'s: every target declares them in one scope`,
      });
    } else if (binding.name === parameter) {
      errors.push({ path: at, message: "must differ from the props parameter's name" });
    }
    if (!taken) names.set(binding.name, `the setup binding "${binding.name}"`);
  }
  return names;
}

/**
 * Checks a component's bindings: each id is its name and offset (plan §5.3), once, in order of
 * their spans. Returns them by id.
 */
function checkBindings(
  component: UfComponent,
  path: string,
  errors: IrValidationError[],
): ReadonlyMap<BindingId, Binding> {
  const bindings = new Map<BindingId, Binding>();
  let previous: number | undefined;
  for (const [index, binding] of component.bindings.entries()) {
    const at = `${path}/bindings/${index}`;
    const expected = `${binding.name}@${binding.span.start}`;
    if (binding.id !== expected) {
      errors.push({
        path: `${at}/id`,
        message: `must be "${expected}", the binding's name and offset`,
      });
    }
    if (bindings.has(binding.id)) {
      errors.push({ path: `${at}/id`, message: `must declare "${binding.id}" once` });
      continue;
    }
    bindings.set(binding.id, binding);
    // Object-form props may all be declared at the parameter, so starts may tie.
    if (previous !== undefined && binding.span.start < previous) {
      errors.push({ path: `${at}/span`, message: "must follow the binding before it" });
    }
    previous = binding.span.start;
  }
  return bindings;
}

/** Checks the types a component's output declares: the module's, each once, in source order. */
function checkComponentTypes(
  component: UfComponent,
  path: string,
  types: ReadonlyMap<string, number>,
  errors: IrValidationError[],
): void {
  let previous = -1;
  const named = new Set<string>();
  for (const [index, name] of component.types.entries()) {
    const at = `${path}/types/${index}`;
    const position = types.get(name);
    if (position === undefined) {
      errors.push({
        path: at,
        message: `must name a type the module declares, and "${name}" is not one`,
      });
    } else if (named.has(name)) {
      errors.push({ path: at, message: `must name "${name}" once` });
    } else if (position < previous) {
      errors.push({ path: at, message: "must list the types in source order" });
    }
    named.add(name);
    if (position !== undefined) previous = Math.max(previous, position);
  }
}

/**
 * Checks a component's props (ADR-0034): names every target can declare, once each; defaults
 * only on optional props of the destructured form, and static; one `prop` binding per prop that
 * has one, named as the prop, and one for every prop in the object form.
 */
function checkProps(component: UfComponent, path: string, walk: Walk): void {
  const { errors, bindings } = walk;
  const parameter = component.propsParameter;
  const objectForm = parameter?.form === "object";
  if (parameter) {
    const at = `${path}/propsParameter`;
    if (objectForm !== (parameter.name !== undefined)) {
      errors.push({
        path: `${at}/name`,
        message: objectForm
          ? "must name the props parameter in the object form"
          : "must be absent in the destructured form",
      });
    } else if (parameter.name !== undefined && !isIdentifier(parameter.name)) {
      errors.push({
        path: `${at}/name`,
        message: `must be an identifier, and "${parameter.name}" is not`,
      });
    } else if (parameter.name !== undefined && reservedPropsParameterName(parameter.name)) {
      errors.push({
        path: `${at}/name`,
        message: `must not start with "$$": ${reservedPropsParameterName(parameter.name)!}`,
      });
    }
    checkSourceText(parameter.type, `${at}/type`, errors);
  } else if (component.props.length) {
    errors.push({
      path: `${path}/props`,
      message: "must be empty for a component without a props parameter",
    });
  }
  const names = new Set<string>();
  const owners = new Map<BindingId, number>();
  for (const [index, prop] of component.props.entries()) {
    const at = `${path}/props/${index}`;
    const reserved = reservedPropName(prop.name);
    if (reserved) {
      errors.push({
        path: `${at}/name`,
        message: `must be a name every target can take: ${reserved}`,
      });
    } else if (names.has(prop.name)) {
      errors.push({ path: `${at}/name`, message: `must declare "${prop.name}" once` });
    }
    names.add(prop.name);
    checkSourceText(prop.type, `${at}/type`, errors);
    if (prop.default) {
      if (!prop.optional) {
        errors.push({ path: `${at}/default`, message: "must be absent on a required prop" });
      } else if (objectForm) {
        errors.push({ path: `${at}/default`, message: "must be absent in the object form" });
      } else if (prop.default.refs.length) {
        errors.push({
          path: `${at}/default/refs`,
          message:
            "must be empty: a default is static, as Vue hoists it out of the component and Angular reads it before any input",
        });
      }
      checkSourceText(prop.default, `${at}/default`, errors);
    }
    if (prop.binding === undefined) {
      if (objectForm) {
        errors.push({ path: at, message: `must have a binding in the object form` });
      }
      continue;
    }
    const binding = bindings.get(prop.binding);
    if (!binding || binding.kind !== "prop" || binding.name !== prop.name) {
      errors.push({
        path: `${at}/binding`,
        message: `must name a prop binding named "${prop.name}", and "${prop.binding}" is not one`,
      });
    }
    owners.set(prop.binding, (owners.get(prop.binding) ?? 0) + 1);
  }
  for (const [index, binding] of component.bindings.entries()) {
    if (binding.kind === "prop" && owners.get(binding.id) !== 1) {
      errors.push({
        path: `${path}/bindings/${index}`,
        message: `must be the binding of one prop, and "${binding.id}" is of ${owners.get(binding.id) ?? 0}`,
      });
    }
  }
}

/** Checks the nodes of a child list, and that no two texts are side by side. */
function checkChildren(children: readonly RenderNode[], place: Place, walk: Walk): void {
  for (const [index, child] of children.entries()) {
    const at = { ...place, path: `${place.path}/${index}` };
    if (child.kind === "Text" && children[index - 1]?.kind === "Text") {
      walk.errors.push({
        path: at.path,
        message: "must not follow another text: adjacent texts are one text node in the DOM",
      });
    }
    checkNode(child, at, walk);
  }
}

function checkNode(node: RenderNode, place: Place, walk: Walk): void {
  switch (node.kind) {
    case "Element":
      checkElement(node, place, walk);
      return;
    case "Text":
      checkText(node.value, place, walk);
      return;
    case "Interpolation": {
      const problem = dynamicTextProblem(place);
      if (problem) walk.errors.push({ path: place.path, message: `must not be ${problem}` });
      checkExpression(node.value, `${place.path}/value`, place.scope, walk);
      return;
    }
    case "If":
      checkIf(node, place, walk);
      return;
    case "For": {
      const { errors, bindings } = walk;
      checkExpression(node.source, `${place.path}/source`, place.scope, walk);
      const scope = new Set(place.scope);
      const declared = node.index === undefined ? [node.item] : [node.item, node.index];
      for (const [position, id] of declared.entries()) {
        const field = position === 0 ? "item" : "index";
        if (position === 1 && id === node.item) {
          errors.push({ path: `${place.path}/index`, message: "must differ from the item" });
          continue;
        }
        const binding = bindings.get(id);
        if (binding?.kind !== "loopVar") {
          errors.push({
            path: `${place.path}/${field}`,
            message: `must name a loop variable of the component, and "${id}" is not one`,
          });
        } else {
          const taken = takenName(binding.name, scope, walk);
          if (taken) {
            errors.push({
              path: `${place.path}/${field}`,
              message: `must not be named "${binding.name}": ${taken}`,
            });
          }
        }
        walk.loopVariables.set(id, (walk.loopVariables.get(id) ?? 0) + 1);
        scope.add(id);
      }
      if (place.element?.tag === "textarea" && place.namespace === "html") {
        errors.push({
          path: place.path,
          message: `must not be in a <textarea>: ${UNINTERPOLATED_ELEMENTS.get("textarea")!}`,
        });
      }
      checkExpression(node.key, `${place.path}/key`, scope, walk);
      checkKey(node.key, declared, `${place.path}/key`, walk);
      const body = { ...place, path: `${place.path}/body`, scope, controlled: true, inList: true };
      if (node.body.kind === "Element") checkElement(node.body, body, walk);
      else checkComponentNode(node.body, body, walk);
      return;
    }
    case "Component":
      checkComponentNode(node, place, walk);
      return;
    case "SlotOutlet":
      checkSlotOutlet(node, place, walk);
      return;
    case "Dynamic":
      checkDynamic(node, place, walk);
      return;
    default:
      unreachable(node);
  }
}

/**
 * Checks a component element (ADR-0053, ADR-0055): it names exactly one component in scope, and
 * each attribute and fill names a declaration of its API.
 */
function checkComponentNode(node: ComponentNode, place: Place, walk: Walk): void {
  const declared = walk.apis.get(node.component);
  if (!declared) {
    walk.errors.push({
      path: `${place.path}/component`,
      message: `must name exactly one imported or local component, and "${node.component}" does not`,
    });
  }
  checkComponentAttributes(node.attributes, declared ? [declared] : [], place, walk);
  checkFills(node.fills, declared ? [declared] : [], `${place.path}/fills`, place, walk);
}

/**
 * Checks a component's attributes: each prop, listener and model declared by every one of
 * `declared` (one component, or each candidate of a `Dynamic` node), each name once. An element's
 * attribute among them is `checkDynamic`'s to report.
 */
function checkComponentAttributes(
  attributes: readonly (Attribute | ComponentAttribute)[],
  declared: readonly Declared[],
  place: Place,
  walk: Walk,
): void {
  const { errors } = walk;
  const seen = new Set<string>();
  for (const [index, attribute] of attributes.entries()) {
    const at = `${place.path}/attributes/${index}`;
    const name = (field: keyof Declared, value: string, what: string, key: string) => {
      if (declared.some((each) => !each[field].has(value))) {
        errors.push({
          path: `${at}/${key}`,
          message: `must name ${what} the component declares, and "${value}" is not one`,
        });
      }
      if (seen.has(`${field} ${value}`)) {
        errors.push({ path: `${at}/${key}`, message: `must set "${value}" once` });
      }
      seen.add(`${field} ${value}`);
    };
    switch (attribute.kind) {
      case "Prop":
        name("props", attribute.name, "a prop", "name");
        checkExpression(attribute.value, `${at}/value`, place.scope, walk);
        break;
      case "Listener":
        name("events", attribute.event, "an event", "event");
        checkComponentListener(attribute.handler, `${at}/handler`, place, walk);
        break;
      case "ModelBinding":
        name("models", attribute.model, "a model", "model");
        checkModelValue(attribute.value, `${at}/value`, place, walk);
        break;
      case "Class":
        checkClass(attribute, at, place, walk);
        break;
      case "Style":
        checkStyle(attribute, at, place, walk);
        break;
      case "Ref":
        checkRef(attribute, at, place, walk);
        break;
      case "Static":
      case "Bound":
      case "Spread":
      case "Event":
      case "Model":
        break;
      default:
        unreachable(attribute);
    }
  }
}

/**
 * Checks a listener of a child's event (ADR-0053): a local function in scope, or a function in
 * place, whose parameters are the event's payload, never a DOM event.
 */
function checkComponentListener(handler: Handler, path: string, place: Place, walk: Walk): void {
  if (handler.kind === "Function") {
    const binding = walk.bindings.get(handler.binding);
    if (binding?.kind !== "localFn" || !place.scope.has(handler.binding)) {
      walk.errors.push({
        path: `${path}/binding`,
        message: `must name a local function, and "${handler.binding}" is not one`,
      });
    }
    return;
  }
  checkFunction(handler.function, `${path}/function`, place.scope, "function", walk);
  if (handler.function.parameters.some((parameter) => parameter.event !== undefined)) {
    walk.errors.push({
      path: `${path}/function/parameters`,
      message: "must take the event's payload, never a DOM event (ADR-0053)",
    });
  }
}

/** The element each control of a `v-model` binds (ADR-0054). */
const MODEL_CONTROLS: Readonly<Record<ModelAttribute["control"], string>> = {
  text: "input",
  number: "input",
  textarea: "textarea",
  select: "select",
  "select-multiple": "select",
  checkbox: "input",
  "checkbox-group": "input",
  radio: "input",
};

/** Checks that `provide` or `inject` names an injection key of the module or an imported one. */
function checkKeyName(key: string, path: string, walk: Walk): void {
  if (!walk.keys.has(key)) {
    walk.errors.push({
      path,
      message: `must name an injection key the module declares or imports, and "${key}" is not one`,
    });
  }
}

/**
 * Checks the slots a component declares (ADR-0054), as `checkEmits` does its events: each name
 * once, and the `slots` binding the one the declaration declares.
 */
function checkSlots(component: UfComponent, path: string, walk: Walk): void {
  const { errors, bindings } = walk;
  const { slots } = component;
  for (const [index, binding] of component.bindings.entries()) {
    if (binding.kind === "slots" && binding.id !== slots?.binding) {
      errors.push({
        path: `${path}/bindings/${index}`,
        message: `must be the binding \`slots\` declares, and "${binding.id}" is not`,
      });
    }
  }
  if (!slots) return;
  const at = `${path}/slots`;
  const binding = bindings.get(slots.binding);
  if (binding?.kind !== "slots" || !inside(binding.span, slots.span)) {
    errors.push({
      path: `${at}/binding`,
      message: `must name the slots binding the declaration declares, and "${slots.binding}" is not one`,
    });
  }
  const names = new Set<string>();
  for (const [index, slot] of slots.slots.entries()) {
    if (names.has(slot.name)) {
      errors.push({
        path: `${at}/slots/${index}/name`,
        message: `must declare "${slot.name}" once`,
      });
    }
    names.add(slot.name);
    if (slot.props) checkSourceText(slot.props, `${at}/slots/${index}/props`, errors);
  }
  checkSourceText(slots.type, `${at}/type`, errors);
}

/** Checks what a component exposes (ADR-0054): its local functions, each once. */
function checkExposes(component: UfComponent, path: string, walk: Walk): void {
  const { exposes } = component;
  if (!exposes) return;
  const seen = new Set<BindingId>();
  for (const [index, id] of exposes.functions.entries()) {
    const at = `${path}/exposes/functions/${index}`;
    if (walk.bindings.get(id)?.kind !== "localFn") {
      walk.errors.push({ path: at, message: `must name a local function, and "${id}" is not one` });
    } else if (seen.has(id)) {
      walk.errors.push({ path: at, message: `must expose "${id}" once` });
    }
    seen.add(id);
  }
}

/** Checks that a model's binding is a `state` or `model` binding's `.value` (ADR-0055). */
function checkModelValue(value: Expression, path: string, place: Place, walk: Walk): void {
  checkExpression(value, path, place.scope, walk);
  const [ref] = value.refs;
  const binding = ref?.kind === "Binding" ? walk.bindings.get(ref.binding) : undefined;
  if (
    value.refs.length !== 1 ||
    ref!.span.start !== value.span.start ||
    ref!.span.end !== value.span.end ||
    (binding?.kind !== "state" && binding?.kind !== "model")
  ) {
    walk.errors.push({
      path,
      message: "must be a state's or a model's `.value`, which the binding writes",
    });
  }
}

/**
 * Checks fills (ADR-0054): each fills a slot every one of `declared` declares, once; a forwarded
 * one passes on a slot the component declares and has no children; a scoped fill's names are in
 * scope in its children alone.
 */
function checkFills(
  fills: readonly SlotFill[],
  declared: readonly Declared[],
  path: string,
  place: Place,
  walk: Walk,
): void {
  const { errors } = walk;
  const seen = new Set<string>();
  for (const [index, fill] of fills.entries()) {
    const at = `${path}/${index}`;
    if (declared.some((each) => !each.slots.has(fill.slot))) {
      errors.push({
        path: `${at}/slot`,
        message: `must name a slot the component declares, and "${fill.slot}" is not one`,
      });
    }
    if (seen.has(fill.slot))
      errors.push({ path: `${at}/slot`, message: `must fill "${fill.slot}" once` });
    seen.add(fill.slot);
    if (fill.forward !== undefined) {
      if (!walk.component.slots?.slots.some(({ name }) => name === fill.forward)) {
        errors.push({
          path: `${at}/forward`,
          message: `must name a slot of the component, and "${fill.forward}" is not one`,
        });
      }
      if (fill.children.length || fill.parameter) {
        errors.push({ path: at, message: "must have no children or parameter when it forwards" });
      }
    }
    const scope = new Set(place.scope);
    if (fill.parameter) {
      const { parameter } = fill;
      for (const binding of walk.component.bindings) {
        if (binding.kind === "slotScope" && inside(binding.span, parameter.span)) {
          scope.add(binding.id);
        }
      }
    }
    // The child places a fill's content: its DOM parent is not known here.
    checkChildren(
      fill.children,
      { ...place, path: `${at}/children`, element: undefined, controlled: true, scope },
      walk,
    );
  }
}

/** Checks a slot outlet (ADR-0054): a slot the component declares, its props and its fallback. */
function checkSlotOutlet(node: SlotOutletNode, place: Place, walk: Walk): void {
  if (!walk.component.slots?.slots.some(({ name }) => name === node.slot)) {
    walk.errors.push({
      path: `${place.path}/slot`,
      message: `must name a slot the component declares, and "${node.slot}" is not one`,
    });
  }
  if (node.props) checkExpression(node.props, `${place.path}/props`, place.scope, walk);
  checkChildren(
    node.fallback,
    { ...place, path: `${place.path}/fallback`, controlled: true },
    walk,
  );
}

/**
 * Checks a `Dynamic` node's element attributes and children as each tag candidate's (ADR-0055):
 * every rule an element of that tag keeps, a `v-model`'s value included. Each candidate is
 * checked apart and a problem reported once, and a template ref counts as one attachment.
 */
function checkTagCandidates(node: DynamicNode, place: Place, walk: Walk): void {
  const attributes: Attribute[] = [];
  for (const attribute of node.attributes) {
    // A component's attribute is reported already, and the paths are by index.
    if (
      attribute.kind === "Prop" ||
      attribute.kind === "Listener" ||
      attribute.kind === "ModelBinding"
    ) {
      return;
    }
    attributes.push(attribute);
  }
  const reported = new Set<string>();
  let attachments: Map<BindingId, number> | undefined;
  for (const candidate of node.candidates) {
    if (candidate.kind !== "Tag") continue;
    const element: ElementNode = {
      kind: "Element",
      tag: candidate.tag,
      attributes,
      children: node.children,
      span: node.span,
    };
    const errors: IrValidationError[] = [];
    const own: Walk = { ...walk, errors, attachments: new Map(walk.attachments) };
    checkAttributes(element, "html", place, own);
    if (isVoidElement(candidate.tag) && node.children.length) {
      errors.push({
        path: `${place.path}/children`,
        message: `must be empty: <${candidate.tag}> is a void element`,
      });
    }
    attachments ??= own.attachments;
    for (const error of errors) {
      const key = `${error.path} ${error.message}`;
      if (!reported.has(key)) walk.errors.push(error);
      reported.add(key);
    }
  }
  for (const [id, count] of attachments ?? []) walk.attachments.set(id, count);
}

/**
 * Checks `<component is>` (ADR-0055): its candidates are all tags, with element attributes and
 * children, or all components, with component attributes and fills that each declares.
 */
function checkDynamic(node: DynamicNode, place: Place, walk: Walk): void {
  const { errors } = walk;
  checkExpression(node.is, `${place.path}/is`, place.scope, walk);
  if (!node.candidates.length) {
    errors.push({ path: `${place.path}/candidates`, message: "must hold a candidate" });
    return;
  }
  const tags = node.candidates.every((candidate) => candidate.kind === "Tag");
  if (!tags && node.candidates.some((candidate) => candidate.kind === "Tag")) {
    errors.push({
      path: `${place.path}/candidates`,
      message: "must be all tags or all components",
    });
    return;
  }
  if (tags) {
    for (const [index, candidate] of node.candidates.entries()) {
      if (candidate.kind === "Tag" && !isHtmlElement(candidate.tag)) {
        errors.push({
          path: `${place.path}/candidates/${index}/tag`,
          message: `must be an HTML element, and "${candidate.tag}" is not one`,
        });
      }
    }
    if (node.fills) {
      errors.push({ path: `${place.path}/fills`, message: "must be absent for tag candidates" });
    }
    for (const [index, attribute] of node.attributes.entries()) {
      if (
        attribute.kind === "Prop" ||
        attribute.kind === "Listener" ||
        attribute.kind === "ModelBinding"
      ) {
        errors.push({
          path: `${place.path}/attributes/${index}`,
          message: "must be an element attribute for tag candidates",
        });
      }
    }
    checkTagCandidates(node, place, walk);
    // The candidate chosen at run time is the children's parent.
    checkChildren(
      node.children,
      { ...place, path: `${place.path}/children`, element: undefined, controlled: true },
      walk,
    );
    return;
  }
  const declared: Declared[] = [];
  for (const [index, candidate] of node.candidates.entries()) {
    const api = candidate.kind === "Component" ? walk.apis.get(candidate.component) : undefined;
    if (api) declared.push(api);
    else {
      errors.push({
        path: `${place.path}/candidates/${index}/component`,
        message: "must name exactly one imported or local component",
      });
    }
  }
  if (node.children.length) {
    errors.push({
      path: `${place.path}/children`,
      message: "must be empty for component candidates: their content is fills",
    });
  }
  for (const [index, attribute] of node.attributes.entries()) {
    if (
      attribute.kind === "Static" ||
      attribute.kind === "Bound" ||
      attribute.kind === "Spread" ||
      attribute.kind === "Event" ||
      attribute.kind === "Model"
    ) {
      errors.push({
        path: `${place.path}/attributes/${index}`,
        message: "must be a component attribute for component candidates",
      });
    }
  }
  checkComponentAttributes(node.attributes, declared, place, walk);
  checkFills(node.fills ?? [], declared, `${place.path}/fills`, place, walk);
}

/**
 * Why a loop variable or a function's parameter cannot take a name where it is (ADR-0035,
 * ADR-0045, UF3024), or `undefined`: the targets that rewrite names (Solid's `props.label`,
 * Angular's `@let`, `track` and members) would read it in place of a prop, a setup binding, the
 * object form's parameter or a loop variable around it of that name, and the outputs reserve
 * some names whatever the component declares.
 */
function takenName(name: string, scope: ReadonlySet<BindingId>, walk: Walk): string | undefined {
  const owner = walk.names.get(name);
  if (owner) return `it would shadow ${owner}`;
  if (name === walk.propsName) return "it would shadow the props parameter";
  for (const id of scope) {
    const other = walk.bindings.get(id);
    if (other?.kind === "loopVar" && other.name === name) {
      return `it would shadow "${id}", a loop variable of a list around it`;
    }
  }
  return reservedParameterName(name);
}

/**
 * Checks a list's key (ADR-0036): it reads the list's item or index, as a key that reads neither
 * is the same for every item, which Vue's and Svelte's compilers reject, and no loop variable of
 * a list around it, which Angular's `track` cannot read (NG8009).
 */
function checkKey(key: Expression, declared: readonly BindingId[], path: string, walk: Walk): void {
  const read = key.refs.flatMap((ref) => (ref.kind === "Binding" ? [ref.binding] : []));
  if (!read.some((id) => declared.includes(id))) {
    walk.errors.push({
      path,
      message:
        "must read the list's item or index: a key that reads neither is the same for every item, which Vue and Svelte reject",
    });
  }
  const outer = read.find(
    (id) => !declared.includes(id) && walk.bindings.get(id)?.kind === "loopVar",
  );
  if (outer !== undefined) {
    walk.errors.push({
      path,
      message: `must not read "${outer}", a loop variable of a list around it: Angular's \`track\` reads only its own item, \`$index\` and the component's members`,
    });
  }
}

/**
 * Why an interpolation, or a branch's text, cannot render alike where the place is, or
 * `undefined`: inside an element whose text the parser moves or drops, a `<textarea>`, or an SVG
 * element that renders no text.
 */
function dynamicTextProblem(place: Place): string | undefined {
  const { element, namespace } = place;
  if (!element) return undefined;
  if (namespace === "svg") {
    return SVG_TEXT_ELEMENTS.has(element.tag)
      ? undefined
      : `in an SVG <${element.tag}>: SVG renders text only in <text>, <tspan>, <textPath>, <title> and <desc>`;
  }
  const reason = UNINTERPOLATED_ELEMENTS.get(element.tag);
  return reason ? `in a <${element.tag}>: ${reason}` : undefined;
}

/**
 * Checks a conditional's shape (ADR-0036): one or more branches, a condition on each but an
 * else that comes last after another, something rendered in some branch and no empty else;
 * and that it adds no text where text cannot render alike.
 */
function checkIf(node: IfNode, place: Place, walk: Walk): void {
  const { errors } = walk;
  const { branches } = node;
  const last = branches.length - 1;
  if (!branches.length) {
    errors.push({ path: `${place.path}/branches`, message: "must have a branch" });
  }
  for (const [index, branch] of branches.entries()) {
    const at = `${place.path}/branches/${index}`;
    if (!branch.condition && index < last) {
      errors.push({ path: at, message: "must have a condition: only the last branch is an else" });
    } else if (!branch.condition && index === 0) {
      errors.push({ path: at, message: "must have a condition: an else follows another branch" });
    } else if (!branch.condition && !branch.children.length) {
      errors.push({ path: at, message: "must render something: an empty else renders nothing" });
    }
    if (branch.condition) checkExpression(branch.condition, `${at}/condition`, place.scope, walk);
    checkChildren(branch.children, { ...place, path: `${at}/children`, controlled: true }, walk);
  }
  if (branches.length && branches.every((branch) => !branch.children.length)) {
    errors.push({ path: `${place.path}/branches`, message: "must render something in a branch" });
  }
  const problem = dynamicTextProblem(place);
  // A <textarea>'s and a raw-text element's content is text, where the comments that mark a
  // conditional render as text too: any conditional there is one.
  const tag = place.namespace === "html" ? place.element?.tag : undefined;
  const textContent = tag === "textarea" || RAW_TEXT_ELEMENTS.has(tag ?? "");
  // Interpolations report themselves, and so does whitespace-only text where Svelte drops it.
  if (problem && (textContent || holdsText(node))) {
    errors.push({ path: place.path, message: `must not render text ${problem}` });
  }
}

/**
 * Whether a conditional's branches hold text that is not only whitespace. A nested conditional
 * reports its own.
 */
function holdsText(node: IfNode): boolean {
  return node.branches.some(({ children }) =>
    children.some((child) => child.kind === "Text" && !isWhitespaceText(child.value)),
  );
}

/** Checks a text: whitespace a target drops, a leading line feed, characters HTML keeps. */
function checkText(value: string, place: Place, walk: Walk): void {
  const { element, namespace } = place;
  const path = `${place.path}/value`;
  if (element && isWhitespaceText(value)) {
    if (namespace === "svg" && !place.inSvgText) {
      walk.errors.push({
        path,
        message: `must not be only whitespace: Svelte's compiler drops it in SVG outside a <${SVG_WHITESPACE_KEEPING_ELEMENT}>, and the other targets keep it`,
      });
    } else if (namespace === "html" && WHITESPACE_DROPPING_ELEMENTS.has(element.tag)) {
      walk.errors.push({
        path,
        message: `must not be only whitespace: Svelte's compiler drops it inside <${element.tag}>, and the other targets keep it`,
      });
    }
  } else if (element && namespace === "html" && RAW_TEXT_ELEMENTS.has(element.tag)) {
    walk.errors.push({
      path,
      message: `must be only whitespace in a <${element.tag}>: ${UNINTERPOLATED_ELEMENTS.get(element.tag)!}`,
    });
  }
  checkCharacters(value, path, walk.errors);
}

/** Checks an element, its attributes and its children, where it sits. */
function checkElement(element: ElementNode, place: Place, walk: Walk): void {
  const { errors } = walk;
  const { path } = place;
  const { tag, children } = element;
  const namespace = elementNamespace(tag, place.namespace);
  const tagProblem =
    (namespace === "svg" ? svgTagProblem(tag, place.element) : htmlTagProblem(tag)) ??
    textOnlyProblem(place) ??
    (namespace === "svg" && tag === "title" && place.controlled
      ? "must not start a conditional's branch or a list's body in SVG: dom-expressions leaves `title` out of its SVG tags, so Solid creates it in HTML's namespace"
      : undefined);
  if (tagProblem) errors.push({ path: `${path}/tag`, message: tagProblem });
  // Angular prints an element with `{{` in a static attribute, and what it holds, in a region
  // where nothing binds (ADR-0037).
  const literal =
    place.literal ||
    element.attributes.some(
      (attribute) =>
        attribute.kind === "Static" && attribute.value !== true && attribute.value.includes("{{"),
    );
  checkAttributes(element, namespace, { ...place, literal }, walk);
  if (namespace === "html" && isVoidElement(tag) && children.length) {
    errors.push({ path: `${path}/children`, message: `must be empty: <${tag}> is a void element` });
  }
  if (namespace === "html" && LEADING_LINE_FEED_ELEMENTS.has(tag)) {
    for (const text of leadingTexts(children, `${path}/children`)) {
      if (text.value.startsWith("\n")) {
        errors.push({
          path: `${text.path}/value`,
          message: `must not start with a line feed: the HTML parser drops it at the start of a <${tag}>, and React's server renderer writes another`,
        });
      }
    }
  }
  checkChildren(
    children,
    {
      path: `${path}/children`,
      element,
      namespace,
      inSvgText: place.inSvgText || (namespace === "svg" && tag === SVG_WHITESPACE_KEEPING_ELEMENT),
      controlled: false,
      inList: place.inList,
      literal,
      scope: place.scope,
    },
    walk,
  );
}

/**
 * The texts that can start an element's content: its first child, a branch's through ifs, and
 * the text after a conditional or a list that can render nothing, where React's and Astro's
 * servers write nothing before it (the other targets write a comment, which keeps the line feed).
 */
function leadingTexts(
  children: readonly RenderNode[],
  path: string,
): { value: string; path: string }[] {
  return leading(children, path).texts;
}

/** The texts that can start a child list, and whether it can render nothing. */
function leading(
  children: readonly RenderNode[],
  path: string,
): { texts: { value: string; path: string }[]; empty: boolean } {
  const texts: { value: string; path: string }[] = [];
  for (const [index, child] of children.entries()) {
    if (child.kind === "Text") {
      texts.push({ value: child.value, path: `${path}/${index}` });
      return { texts, empty: false };
    }
    // A list's body is an element: it renders elements, or nothing.
    if (child.kind === "For") continue;
    if (child.kind !== "If") return { texts, empty: false };
    // Without an else, or with a branch that can render nothing, a conditional can too.
    let empty = child.branches.at(-1)?.condition !== undefined;
    for (const [number, branch] of child.branches.entries()) {
      const inner = leading(branch.children, `${path}/${index}/branches/${number}/children`);
      texts.push(...inner.texts);
      empty ||= inner.empty;
    }
    if (!empty) return { texts, empty: false };
  }
  return { texts, empty: true };
}

/** Why an HTML-namespace tag is not one a component can render as itself, or `undefined`. */
function htmlTagProblem(tag: string): string | undefined {
  const unrenderable = UNRENDERABLE_ELEMENTS.get(tag);
  if (unrenderable) return `must be an element a component can render: ${unrenderable}`;
  const unportable = UNPORTABLE_ELEMENTS.get(tag);
  if (unportable) return `must be an element every target renders as itself: ${unportable}`;
  if (isHtmlElement(tag)) return undefined;
  return isSvgElement(tag)
    ? `must be an HTML element, and <${tag}> is not: SVG elements sit inside an <svg>`
    : `must be an HTML element, and <${tag}> is not`;
}

/**
 * Why no element can sit where this one does: inside an HTML element whose content is text, as
 * the parser reads markup there (`<option>`, `<textarea>`, `<title>`), or `undefined`.
 */
function textOnlyProblem(place: Place): string | undefined {
  const parent = place.element;
  if (!parent || place.namespace !== "html" || !TEXT_ONLY_ELEMENTS.has(parent.tag)) {
    return undefined;
  }
  // A conditional or a list in a <textarea> reports itself.
  if (place.controlled && parent.tag === "textarea") return undefined;
  return `must not be inside <${parent.tag}>: its content is text, and the HTML parser reads markup there as text`;
}

/** Why an SVG-namespace tag is not one a component can render, or `undefined`. */
function svgTagProblem(tag: string, parent: ElementNode | undefined): string | undefined {
  const unrenderable = SVG_UNRENDERABLE_ELEMENTS.get(tag);
  if (unrenderable) return `must be an element a component can render: ${unrenderable}`;
  if (!isSvgElement(tag)) {
    return `must be an SVG element, and <${tag}> is not: the HTML parser leaves SVG at some HTML elements, and the targets create others in SVG or HTML`;
  }
  if (parent && SVG_HTML_INTEGRATION_POINTS.has(parent.tag)) {
    return `must not be inside an SVG <${parent.tag}>: the HTML parser and Vue read its elements as HTML, and React as SVG`;
  }
  return undefined;
}

/**
 * Checks an element's attributes: names of the element, set once across every kind (one spread
 * `class` key merges with the element's own `class`), none a target renders differently, and
 * each kind's values.
 */
function checkAttributes(
  element: ElementNode,
  namespace: Namespace,
  place: Place,
  walk: Walk,
): void {
  const { errors } = walk;
  const { tag, attributes, children } = element;
  // `type` is an enumerated attribute, read without case; the first one is the one HTML keeps.
  // A bound `type` leaves it unknown, so an input's `value` is state.
  const type = attributes.find(
    (attribute) => attribute.kind === "Static" && attribute.name === "type",
  );
  const staticType =
    type?.kind === "Static" && typeof type.value === "string" ? type.value : undefined;
  const seen = new Set<string>();
  const listeners = new Set<string>();
  let ownClass = false;
  let spreadClass = false;
  let ref = false;
  /** Claims a name for one attribute, or reports it set twice. */
  const claim = (name: string, path: string, fromSpread: boolean) => {
    if (name === "class") {
      const taken = fromSpread ? spreadClass : ownClass;
      if (fromSpread) spreadClass = true;
      else ownClass = true;
      if (!taken) return;
    } else if (!seen.has(name)) {
      seen.add(name);
      return;
    }
    errors.push({ path, message: `must set "${name}" once` });
  };
  /** The checks of a name every kind has: of the element, and rendered alike. */
  const checkName = (name: string, path: string): boolean => {
    const known = namespace === "svg" ? isSvgAttribute(tag, name) : isHtmlAttribute(tag, name);
    if (!known) {
      errors.push({ path, message: `must be an attribute of <${tag}>` });
      return false;
    }
    const unportable =
      undeclaredAttribute(tag, namespace, name) ??
      (namespace === "html"
        ? unportableAttribute(tag, name, staticType, children.length > 0)
        : undefined);
    if (unportable) {
      errors.push({ path, message: `must not be set: ${unportable}` });
      return false;
    }
    return true;
  };
  /** The checks of a bound name, as a bound attribute or a spread's key (ADR-0037). */
  const checkBoundName = (name: string, path: string): void => {
    const reason =
      name === "style"
        ? "a `style` is a Style attribute, and a spread's `style` lands in M4"
        : namespace === "html"
          ? unbindableAttribute(tag, name)
          : undefined;
    if (reason) {
      errors.push({ path, message: `must not be bound: ${reason}` });
    } else if (
      namespace === "html" &&
      isBooleanAttribute(name) &&
      !BINDABLE_BOOLEAN_ATTRIBUTES.has(name)
    ) {
      errors.push({
        path,
        message: `must not be bound: Vue's server or Svelte renders a false \`${name}\` as "false", as they do not read it as a boolean`,
      });
    }
  };
  for (const [index, attribute] of attributes.entries()) {
    const at = `${place.path}/attributes/${index}`;
    switch (attribute.kind) {
      case "Static": {
        const { name, value } = attribute;
        if (checkName(name, `${at}/name`) && name === "style") {
          errors.push({
            path: `${at}/name`,
            message: "must not be a static attribute: a `style` is a Style attribute (ADR-0038)",
          });
        }
        claim(name, `${at}/name`, false);
        checkStaticValue(tag, namespace, name, value, `${at}/value`, errors);
        break;
      }
      case "Bound": {
        const { name } = attribute;
        if (checkName(name, `${at}/name`)) {
          if (name === "class") {
            errors.push({
              path: `${at}/name`,
              message: "must not be bound: a `class` is a Class attribute (ADR-0038)",
            });
          } else {
            checkBoundName(name, `${at}/name`);
          }
        }
        claim(name, `${at}/name`, false);
        checkExpression(attribute.value, `${at}/value`, place.scope, walk);
        break;
      }
      case "Class":
        claim("class", at, false);
        checkClass(attribute, at, place, walk);
        break;
      case "Style":
        claim("style", at, false);
        checkStyle(attribute, at, place, walk);
        break;
      case "Spread":
        for (const [key, { name }] of attribute.keys.entries()) {
          const path = `${at}/keys/${key}/name`;
          if (checkName(name, path)) checkBoundName(name, path);
          claim(name, path, true);
        }
        checkExpression(attribute.value, `${at}/value`, place.scope, walk);
        break;
      case "Event": {
        const option = attribute.capture ? "capture" : attribute.once ? "once" : "passive";
        const key = `${attribute.event} ${attribute.capture || attribute.once || attribute.passive ? option : ""}`;
        if (listeners.has(key)) {
          errors.push({
            path: at,
            message: `must listen to "${attribute.event}" once with its options on an element`,
          });
        }
        listeners.add(key);
        checkListener(attribute, at, place, walk);
        break;
      }
      case "Ref":
        if (ref) errors.push({ path: at, message: "must attach the element to one template ref" });
        ref = true;
        checkRef(attribute, at, place, walk);
        break;
      case "Model":
        if (MODEL_CONTROLS[attribute.control] !== tag) {
          errors.push({
            path: `${at}/control`,
            message: `must be a control of <${tag}>: "${attribute.control}" binds a <${MODEL_CONTROLS[attribute.control]}>`,
          });
        }
        checkModelValue(attribute.value, `${at}/value`, place, walk);
        break;
      default:
        unreachable(attribute);
    }
  }
}

/**
 * Checks an event listener (ADR-0047): an event of the vocabulary, at most one option, `passive`
 * only where it counts, outside Angular's literal region, and a handler that takes the event as
 * an interface it has and uses only what every target's event object carries.
 */
function checkListener(attribute: EventAttribute, path: string, place: Place, walk: Walk): void {
  const { errors, bindings } = walk;
  const { event, handler } = attribute;
  if (!DOM_EVENTS.has(event)) {
    const unsupported = UNSUPPORTED_EVENTS.get(event);
    errors.push({
      path: `${path}/event`,
      message: WINDOW_EVENTS.has(event)
        ? `must be an event an element receives, and "${event}" only the window does`
        : unsupported
          ? `must be an event every target listens to alike, and "${event}" is not: ${unsupported}`
          : `must be an event of the vocabulary (\`DOM_EVENTS\`), and "${event}" is not one`,
    });
  }
  const options = [attribute.capture, attribute.once, attribute.passive].filter(Boolean).length;
  if (options > 1) {
    errors.push({
      path,
      message: "must set at most one option: a listener's name takes one suffix (ADR-0017)",
    });
  }
  if (attribute.passive && !PASSIVE_EVENTS.has(event)) {
    errors.push({
      path: `${path}/passive`,
      message: `must be absent on "${event}": a listener is passive only on ${[...PASSIVE_EVENTS].join(", ")}, where it lets scrolling go on`,
    });
  }
  if (place.literal) {
    errors.push({
      path,
      message:
        "must not be in Angular's literal region: an element with `{{` in a static attribute, or inside one, binds nothing there (ADR-0037)",
    });
  }
  const at = `${path}/handler`;
  if (handler.kind === "Function") {
    const binding = bindings.get(handler.binding);
    if (binding?.kind !== "localFn" || !place.scope.has(handler.binding)) {
      errors.push({
        path: `${at}/binding`,
        message: `must name a local function, and "${handler.binding}" is not one`,
      });
      return;
    }
    const item = walk.functions.get(handler.binding);
    if (item) checkHandledEvent(item.function, event, at, walk);
  } else {
    const fn = handler.function;
    checkFunction(fn, `${at}/function`, place.scope, "handler", walk);
    checkHandledEvent(fn, event, at, walk);
  }
}

/**
 * Checks a function that handles an event: its first parameter, which the event is passed to, is
 * its event parameter, of the event's interface or one it extends, and its code uses only the
 * members every target's event object carries for that event (ADR-0047, UF3032).
 */
function checkHandledEvent(fn: FunctionCode, event: string, path: string, walk: Walk): void {
  const dom = DOM_EVENTS.get(event);
  if (dom === undefined) return;
  const [first] = fn.parameters;
  if (first && first.event === undefined) {
    walk.errors.push({
      path,
      message: `must handle "${event}" with a function whose first parameter is its event parameter`,
    });
  } else if (first?.event !== undefined && !extendsEventInterface(dom, first.event)) {
    walk.errors.push({
      path,
      message: `must take "${event}" as ${dom} or an interface it extends, and ${first.event} is not one`,
    });
  }
  const portable = PORTABLE_EVENT_MEMBERS.get(PORTABLE_EVENT_INTERFACES.get(event)!)!;
  for (const ref of fn.body.refs) {
    if (ref.kind === "Event" && !portable.has(ref.member)) {
      walk.errors.push({
        path,
        message: `must use only the members every target's "${event}" event has, and \`${ref.member}\` is not one (\`PORTABLE_EVENT_INTERFACES\`)`,
      });
    }
  }
}

/**
 * Checks a template ref's attachment (ADR-0049): a `templateRef` binding, outside any list, where
 * Vue would give an array of elements, and outside Angular's literal region.
 */
function checkRef(attribute: RefAttribute, path: string, place: Place, walk: Walk): void {
  const binding = walk.bindings.get(attribute.binding);
  if (binding?.kind !== "templateRef") {
    walk.errors.push({
      path: `${path}/binding`,
      message: `must name a template ref, and "${attribute.binding}" is not one`,
    });
  } else {
    walk.attachments.set(binding.id, (walk.attachments.get(binding.id) ?? 0) + 1);
  }
  if (place.inList) {
    walk.errors.push({
      path,
      message: "must not be in a list: Vue fills a template ref there with an array of elements",
    });
  }
  if (place.literal) {
    walk.errors.push({
      path,
      message:
        "must not be in Angular's literal region: an element with `{{` in a static attribute, or inside one, binds nothing there (ADR-0037)",
    });
  }
}

/** Checks a static attribute's value: booleans, and what the targets render differently. */
function checkStaticValue(
  tag: string,
  namespace: Namespace,
  name: string,
  value: string | true,
  path: string,
  errors: IrValidationError[],
): void {
  if (namespace === "svg") {
    if (value === true) {
      errors.push({
        path,
        message: `must be a string: SVG has no boolean attributes, and "${name}" is on an SVG <${tag}>`,
      });
    }
  } else if ((value === true) !== isBooleanAttribute(name)) {
    errors.push({
      path,
      message:
        value === true
          ? `must be a string: only boolean attributes are true, and "${name}" is not one`
          : `must be true: "${name}" is a boolean attribute`,
    });
  }
  if (typeof value !== "string") return;
  const problem = valueProblem(tag, namespace, name, value);
  if (problem) errors.push({ path, message: problem });
  checkCharacters(value, path, errors);
}

/**
 * Checks a `class`'s parts (ADR-0038): static names canonical, a toggle's name one class name,
 * and no name twice among them.
 */
function checkClass(attribute: ClassAttribute, path: string, place: Place, walk: Walk): void {
  const { errors } = walk;
  const names = new Set<string>();
  for (const [index, item] of attribute.items.entries()) {
    const at = `${path}/items/${index}`;
    let written: string[] = [];
    switch (item.kind) {
      case "Static":
        if (!CANONICAL_CLASS.test(item.value)) {
          errors.push({
            path: `${at}/value`,
            message: "must be class names separated by single spaces",
          });
        } else {
          written = item.value.split(" ");
        }
        checkCharacters(item.value, `${at}/value`, errors);
        break;
      case "Toggle":
        if (!/^\S+$/u.test(item.name)) {
          errors.push({ path: `${at}/name`, message: "must be one class name" });
        } else {
          written = [item.name];
        }
        checkCharacters(item.name, `${at}/name`, errors);
        checkExpression(item.condition, `${at}/condition`, place.scope, walk);
        break;
      case "Dynamic":
        checkExpression(item.value, `${at}/value`, place.scope, walk);
        break;
      default:
        unreachable(item);
    }
    for (const name of written) {
      if (names.has(name)) {
        errors.push({ path: at, message: `must name the class "${name}" once` });
      }
      names.add(name);
    }
  }
}

/**
 * Checks a `style`'s declarations (ADR-0038): CSS property names, in lower case as Angular
 * writes them, none setting what another sets (the object targets cannot keep their order), and
 * static values that are one CSS value, which Angular's style parser reads as written.
 */
function checkStyle(attribute: StyleAttribute, path: string, place: Place, walk: Walk): void {
  const { errors } = walk;
  const properties: string[] = [];
  for (const [index, declaration] of attribute.declarations.entries()) {
    const at = `${path}/declarations/${index}`;
    const { property } = declaration;
    if (!isCssPropertyName(property)) {
      errors.push({
        path: `${at}/property`,
        message: `must be a CSS property in lower case and without a vendor prefix, or a custom property, and "${property}" is not`,
      });
    } else if (!isKnownCssProperty(property)) {
      errors.push({
        path: `${at}/property`,
        message: `must be a CSS property the browsers know (\`CSS_PROPERTIES\`), or a custom property, and "${property}" is not`,
      });
    } else if (angularLowercases(property)) {
      errors.push({
        path: `${at}/property`,
        message: `must be in lower case: Angular's compiler and server DOM lowercase a custom property's name, and "${property}" is not`,
      });
    } else {
      const other = properties.find((earlier) => cssPropertiesOverlap(earlier, property));
      if (other !== undefined) {
        errors.push({
          path: `${at}/property`,
          message:
            other === property
              ? `must set "${property}" once`
              : `must not set what "${other}" sets: the targets that write a style as an object cannot keep the order that decides it`,
        });
      }
      properties.push(property);
    }
    if (declaration.kind === "Static") {
      const problem =
        cssValueProblem(declaration.value) ??
        (angularMisreads(declaration.value)
          ? "must be read alike by Angular's style parser, which knows neither escapes nor comments and counts the parentheses inside strings"
          : undefined);
      if (problem) errors.push({ path: `${at}/value`, message: problem });
      checkCharacters(declaration.value, `${at}/value`, errors);
    } else {
      checkExpression(declaration.value, `${at}/value`, place.scope, walk);
    }
  }
}

/**
 * Checks a template expression's structure (ADR-0035): it is the source at its span, and its
 * references lie in it, in order and apart, each spanning the binding it names (in scope here)
 * or an allowed global, as render code may (ADR-0045). The IR cannot parse the code: the
 * compiler checks a plugin's code against the analyser's.
 */
function checkExpression(
  expression: Expression,
  path: string,
  scope: ReadonlySet<BindingId>,
  walk: Walk,
): void {
  const { errors } = walk;
  const { code, span, refs } = expression;
  if (!checkSourceText(expression, path, errors)) return;
  let end = span.start;
  for (const [index, ref] of refs.entries()) {
    const at = `${path}/refs/${index}`;
    if (ref.span.start < end || ref.span.end > span.end || ref.span.start >= ref.span.end) {
      errors.push({
        path: `${at}/span`,
        message: "must lie in the expression, after the reference before it",
      });
      continue;
    }
    end = ref.span.end;
    const text = code.slice(ref.span.start - span.start, ref.span.end - span.start);
    if (ref.kind === "Global") {
      checkGlobal(ref.name, text, at, "render", walk);
    } else if (ref.kind === "Slot") {
      checkSlotReference(ref, text, at, walk);
    } else {
      checkBindingReference(ref, text, at, scope, "render", walk);
      if (ref.narrowed) checkNarrowed(ref, expression, at, "render", walk);
    }
  }
}

/** Checks a slot's presence (ADR-0054): `slots.title`, of a slot the component declares. */
function checkSlotReference(ref: SlotReference, text: string, path: string, walk: Walk): void {
  const { slots } = walk.component;
  const name = slots ? walk.bindings.get(slots.binding)?.name : undefined;
  if (!slots?.slots.some((slot) => slot.name === ref.slot)) {
    walk.errors.push({
      path: `${path}/slot`,
      message: `must name a slot the component declares, and "${ref.slot}" is not one`,
    });
  } else if (name === undefined || !isMemberOf(text, name, ref.slot)) {
    walk.errors.push({
      path: `${path}/span`,
      message: `must span "${name ?? "slots"}.${ref.slot}"`,
    });
  }
}

/** The globals each context may read (ADR-0035, ADR-0045). */
const GLOBALS: Readonly<Record<Context, ReadonlySet<string>>> = {
  render: ALLOWED_GLOBALS,
  initial: PURE_GLOBALS,
  getter: PURE_GLOBALS,
  client: CLIENT_GLOBALS,
};

/** What each context is, for messages. */
const CONTEXT_NAMES: Readonly<Record<Context, string>> = {
  render: "a template",
  initial: "an initial value",
  getter: "a getter",
  client: "client code",
};

/** Checks a global reference: one its context may read, spanning its name. */
function checkGlobal(name: string, text: string, path: string, context: Context, walk: Walk): void {
  if (!GLOBALS[context].has(name)) {
    walk.errors.push({
      path: `${path}/name`,
      message:
        context === "render"
          ? `must be a global expressions may read, and "${name}" is not one`
          : `must be a global ${CONTEXT_NAMES[context]} may read, and "${name}" is not one`,
    });
  } else if (text !== name) {
    walk.errors.push({ path: `${path}/span`, message: `must span "${name}"` });
  }
}

/**
 * Checks a reference to a binding: one of the component's, in scope, spanning what the targets
 * replace, and a use its context allows.
 */
function checkBindingReference(
  ref: { binding: BindingId; shorthand?: true; call?: true; later?: true },
  text: string,
  path: string,
  scope: ReadonlySet<BindingId>,
  context: Context,
  walk: Walk,
): void {
  const { errors } = walk;
  const binding = walk.bindings.get(ref.binding);
  if (!binding) {
    errors.push({
      path: `${path}/binding`,
      message: `must name a binding of the component, and "${ref.binding}" is not one`,
    });
    return;
  }
  if (!scope.has(ref.binding)) {
    errors.push({
      path: `${path}/binding`,
      message:
        binding.kind === "slotScope"
          ? `must name a binding in scope here, and "${ref.binding}" is a scoped fill's name outside its fill`
          : `must name a binding in scope here, and "${ref.binding}" is a loop variable of another list`,
    });
    return;
  }
  // The targets splice at the span: a prop in the object form is read only as a member of the
  // parameter, the whole `props.label` (ADR-0035), a ref's value as the whole `count.value`
  // (ADR-0045), and every other binding by name.
  const expected = referenceText(binding, walk);
  const spans =
    expected.member === undefined
      ? text === binding.name
      : isMemberOf(text, expected.object, expected.member);
  if (!spans) {
    errors.push({ path: `${path}/span`, message: `must span "${expected.text}"` });
    return;
  }
  if (ref.shorthand && expected.member !== undefined) {
    errors.push({
      path: `${path}/shorthand`,
      message: `must be absent on a reference that spans "${expected.text}"`,
    });
  }
  const problem = useProblem(binding, ref.call === true, context, walk);
  if (problem) errors.push({ path: `${path}/${problem.field}`, message: problem.message });
  // Only client code hands a function to a call that runs it later (ADR-0048).
  if (ref.later && context !== "client") {
    errors.push({
      path: `${path}/later`,
      message: `must be absent in ${CONTEXT_NAMES[context]}, which runs nothing later`,
    });
  }
}

/**
 * A member path off a read (ADR-0046): `.name` and literal keys (`[0]`, `["key"]`), with only
 * whitespace between, and no `?.`.
 */
const MEMBER_PATH =
  /^(?:\s*\.\s*[A-Za-z_$][A-Za-z0-9_$]*|\s*\[\s*(?:0|[1-9][0-9]*|"[^"\\\n]*"|'[^'\\\n]*')\s*\])+$/u;

/**
 * Whether text is a member path a narrowed read may extend over (`.email`, `[0].name`): the
 * analyser marks no other, which the targets assert a path after.
 */
export function isMemberPath(text: string): boolean {
  return MEMBER_PATH.test(text);
}

/**
 * Checks the narrowed paths of a read (ADR-0046): on a prop's or a ref's value's read, which is no
 * call; each from the read's start to its end or a member path off it, in the code, longer than
 * the one before; `template` only in client code, and `closure` only on a destructured prop's own read.
 */
function checkNarrowed(
  ref: BindingReference,
  container: Expression | Code,
  path: string,
  context: Context,
  walk: Walk,
): void {
  const { errors } = walk;
  const at = `${path}/narrowed`;
  const binding = walk.bindings.get(ref.binding);
  const kind = binding?.kind;
  if (kind !== "prop" && kind !== "state" && kind !== "derived" && kind !== "templateRef") {
    errors.push({
      path: at,
      message: "must be absent: only a prop's or a ref's value's read narrows",
    });
    return;
  }
  if (ref.call) errors.push({ path: at, message: "must be absent on a call" });
  if (!ref.narrowed!.length) {
    errors.push({ path: at, message: "must hold a path, or be absent" });
    return;
  }
  let end = -1;
  for (const [index, narrowing] of ref.narrowed!.entries()) {
    const where = `${at}/${index}`;
    const { span } = narrowing;
    if (
      span.start !== ref.span.start ||
      span.end < ref.span.end ||
      span.end <= end ||
      !inside(span, container.span)
    ) {
      errors.push({
        path: `${where}/span`,
        message:
          "must start at the read, end at it or after it in the code, and be longer than the path before it",
      });
      continue;
    }
    end = span.end;
    const tail = container.code.slice(
      ref.span.end - container.span.start,
      span.end - container.span.start,
    );
    if (tail && !isMemberPath(tail)) {
      errors.push({
        path: `${where}/span`,
        message:
          "must end at the read or at a member path off it, written with `.` and literal keys",
      });
    }
    if (narrowing.scope === "template" && context !== "client") {
      errors.push({
        path: `${where}/scope`,
        message:
          "must not be `template` outside client code: only a handler's code is narrowed by the template around it",
      });
    }
    if (
      narrowing.scope === "closure" &&
      (kind !== "prop" || walk.propsName !== undefined || span.end !== ref.span.end)
    ) {
      errors.push({
        path: `${where}/scope`,
        message:
          "must not be `closure` but on a destructured prop's own read: TypeScript forgets a property's narrowing in a closure",
      });
    }
  }
}

/** The operators of a write that read its target first (`count.value += 1`). */
const READING_OPERATORS: ReadonlySet<string> = new Set([
  "+=",
  "-=",
  "*=",
  "/=",
  "%=",
  "**=",
  "++",
  "--",
]);

/**
 * Checks a write's narrowed target (ADR-0046): a state's, whose operator reads it, as one `local`
 * path spanning the target.
 */
function checkWriteNarrowed(
  ref: WriteReference,
  binding: Binding | undefined,
  path: string,
  walk: Walk,
): void {
  const at = `${path}/narrowed`;
  if (binding?.kind !== "state" || !READING_OPERATORS.has(ref.operator)) {
    walk.errors.push({
      path: at,
      message: "must be absent but on a write of a state whose operator reads it (`+=`, `++`, …)",
    });
    return;
  }
  const [only, ...rest] = ref.narrowed!;
  if (
    !only ||
    rest.length ||
    only.span.start !== ref.target.start ||
    only.span.end !== ref.target.end ||
    only.scope !== "local"
  ) {
    walk.errors.push({ path: at, message: "must hold one `local` path spanning the target" });
  }
}

/** What a reference to a binding spans: its name, or a member of an object. */
function referenceText(
  binding: Binding,
  walk: Walk,
): { text: string; object: string; member?: string } {
  if (binding.kind === "prop" && walk.propsName !== undefined) {
    return {
      text: `${walk.propsName}.${binding.name}`,
      object: walk.propsName,
      member: binding.name,
    };
  }
  if (
    binding.kind === "state" ||
    binding.kind === "derived" ||
    binding.kind === "templateRef" ||
    binding.kind === "model" ||
    (binding.kind === "context" && injectsRef(binding, walk))
  ) {
    return { text: `${binding.name}.value`, object: binding.name, member: "value" };
  }
  return { text: binding.name, object: binding.name };
}

/** Whether an injection key's value type is a ref: `Ref<number>`, `ComputedRef<…>`, a model's. */
function holdsRef(type: string): boolean {
  return /^(Ref|ComputedRef|ModelRef)</.test(type.trim());
}

/** Whether a `context` binding injects a key that holds a ref, which is read as `x.value`. */
function injectsRef(binding: Binding, walk: Walk): boolean {
  const item = walk.component.setup.find(
    (each) => each.kind === "Inject" && each.binding === binding.id,
  );
  return item?.kind === "Inject" && walk.keys.get(item.key) === true;
}

/**
 * Checks what `provide` gives, or `inject` falls back to, for a key that holds a ref (ADR-0054):
 * the ref itself, a `state`, `derived` or `model` binding by its name, which stays reactive.
 */
function checkProvidedRef(code: Code, path: string, walk: Walk): void {
  const [ref, ...more] = code.refs;
  const binding = ref?.kind === "Binding" ? walk.bindings.get(ref.binding) : undefined;
  if (
    more.length ||
    !binding ||
    (binding.kind !== "state" && binding.kind !== "derived" && binding.kind !== "model") ||
    code.code !== binding.name ||
    ref!.span.start !== code.span.start ||
    ref!.span.end !== code.span.end
  ) {
    walk.errors.push({
      path,
      message:
        "must be a `state`, `derived` or `model` binding by its name: a key of a ref takes the ref itself",
    });
  }
}

/**
 * Why code in a context may not use a binding so, or `undefined` (ADR-0045): only a local
 * function is called; `emit` only emits; and outside client code no template ref, setup `let`
 * or function value is read, and only pure local functions are called, a getter's reading
 * static values alone, which Qwik hoists out of the component.
 */
function useProblem(
  binding: Binding,
  call: boolean,
  context: Context,
  walk: Walk,
): { field: string; message: string } | undefined {
  const { id, kind } = binding;
  if (call && kind !== "localFn") {
    return {
      field: "call",
      message: `must be absent: only a local function is called, and "${id}" is a ${kind} binding`,
    };
  }
  const where = CONTEXT_NAMES[context];
  switch (kind) {
    case "emit":
      return {
        field: "binding",
        message: `must not name "${id}": code calls \`emit\` only as an emit of a declared event (ADR-0047)`,
      };
    case "templateRef":
      return context === "client"
        ? undefined
        : {
            field: "binding",
            message: `must not read the template ref "${id}" in ${where}: only client code may, once the element is mounted (ADR-0049)`,
          };
    case "localVar":
      return context === "client"
        ? undefined
        : {
            field: "binding",
            message: `must not read the setup \`let\` "${id}" in ${where}: it is not reactive, so only client code may (ADR-0045)`,
          };
    case "localFn": {
      if (context === "client") return undefined;
      if (!call) {
        return {
          field: "binding",
          message: `must call the local function "${id}": only client code passes one as a value (ADR-0045)`,
        };
      }
      const summary = walk.summaries.get(id);
      const impure = summary && impurity(summary);
      if (impure) {
        return {
          field: "binding",
          message: `must call only a pure local function in ${where}, and "${id}" is not: ${impure}`,
        };
      }
      const free =
        context === "getter"
          ? [...(summary?.reads ?? [])].find((read) => !walk.staticConsts.has(read))
          : undefined;
      return free === undefined
        ? undefined
        : {
            field: "binding",
            message: `must call only a local function that reads static values in a getter, which Qwik hoists out of the component, and "${id}" reads "${free}"`,
          };
    }
    case "slots":
      return {
        field: "binding",
        message: `must not name "${id}": a slot is rendered, tested or forwarded, and nothing else (ADR-0054)`,
      };
    case "component":
      return context === "render"
        ? undefined
        : {
            field: "binding",
            message: `must not read the component "${id}" in ${where}: only \`<component is>\` chooses one (ADR-0054)`,
          };
    case "prop":
    case "loopVar":
    case "state":
    case "derived":
    case "localConst":
    case "model":
    case "slotScope":
    case "context":
      return undefined;
    default:
      return unreachable(kind);
  }
}

/** The event parameter of the function whose body code is: what its `Event` references read. */
interface EventScope {
  readonly parameter: Parameter;
}

/**
 * Checks a piece of setup code (ADR-0045): it is the source at its span; its references lie in
 * it in order, apart but for those inside a write's value or an emit's argument, which follow it;
 * and each is one its context allows: writes, emits and `nextTick` only in client code, and a
 * handler's event only in a function with an event parameter.
 */
function checkCode(
  code: Code,
  path: string,
  scope: ReadonlySet<BindingId>,
  context: Context,
  walk: Walk,
  event?: EventScope,
): void {
  const { errors, bindings } = walk;
  if (!checkSourceText(code, path, errors)) return;
  /** The writes and emits around the current reference, with where theirs may lie. */
  const open: { end: number; slots: readonly Span[] }[] = [];
  let cursor = code.span.start;
  for (const [index, ref] of code.refs.entries()) {
    const at = `${path}/refs/${index}`;
    if (!inside(ref.span, code.span) || ref.span.start >= ref.span.end) {
      errors.push({ path: `${at}/span`, message: "must lie in the code" });
      continue;
    }
    while (open.length && ref.span.start >= open.at(-1)!.end) {
      cursor = Math.max(cursor, open.pop()!.end);
    }
    const around = open.at(-1);
    if (ref.span.start < cursor) {
      errors.push({ path: `${at}/span`, message: "must follow the reference before it" });
      continue;
    }
    if (around && !around.slots.some((slot) => inside(ref.span, slot))) {
      errors.push({
        path: `${at}/span`,
        message: "must lie in the value of the write or an argument of the emit it is in",
      });
      continue;
    }
    const text = code.code.slice(ref.span.start - code.span.start, ref.span.end - code.span.start);
    cursor = ref.span.end;
    switch (ref.kind) {
      case "Binding":
        checkBindingReference(ref, text, at, scope, context, walk);
        if (ref.narrowed) checkNarrowed(ref, code, at, context, walk);
        break;
      case "Global":
        checkGlobal(ref.name, text, at, context, walk);
        break;
      case "Write": {
        if (context !== "client") {
          errors.push({
            path: at,
            message: `must not write in ${CONTEXT_NAMES[context]}: only client code writes (ADR-0045)`,
          });
        }
        const binding = bindings.get(ref.binding);
        // An injected value is read-only (ADR-0055): only a state, a model or a `let` is written.
        if (
          (binding?.kind !== "state" &&
            binding?.kind !== "model" &&
            binding?.kind !== "localVar") ||
          !scope.has(ref.binding)
        ) {
          errors.push({
            path: `${at}/binding`,
            message: `must name a state, a model or a setup \`let\`, and "${ref.binding}" is not one`,
          });
        } else {
          const valued = binding.kind !== "localVar";
          const target = `${binding.name}${valued ? ".value" : ""}`;
          const written = slice(code, ref.target);
          if (
            !inside(ref.target, ref.span) ||
            (valued ? !isMemberOf(written, binding.name, "value") : written !== binding.name)
          ) {
            errors.push({ path: `${at}/target`, message: `must span "${target}" in the write` });
          }
        }
        const update = ref.operator === "++" || ref.operator === "--";
        if (update === (ref.value !== undefined)) {
          errors.push({
            path: `${at}/value`,
            message: update
              ? `must be absent for "${ref.operator}"`
              : `must be present for "${ref.operator}"`,
          });
        } else if (
          ref.value &&
          (!inside(ref.value, ref.span) || ref.value.start < ref.target.end)
        ) {
          errors.push({ path: `${at}/value`, message: "must lie in the write, after its target" });
        }
        if (ref.narrowed) checkWriteNarrowed(ref, binding, at, walk);
        open.push({ end: ref.span.end, slots: ref.value ? [ref.value] : [] });
        cursor = ref.span.start;
        break;
      }
      case "Emit":
        checkEmit(ref, text, at, context, walk);
        open.push({ end: ref.span.end, slots: ref.arguments });
        cursor = ref.span.start;
        break;
      case "Api":
        if (context !== "client") {
          errors.push({
            path: at,
            message: `must not call \`nextTick\` in ${CONTEXT_NAMES[context]}: only client code may (ADR-0048)`,
          });
        } else if (!isIdentifier(text)) {
          errors.push({ path: `${at}/span`, message: "must span the API's identifier" });
        } else if (!CALLED_BARE.test(code.code.slice(ref.span.end - code.span.start))) {
          errors.push({
            path: at,
            message:
              "must be called without arguments: `await nextTick()` is its one form, and some targets' `nextTick` takes no callback (UF2025)",
          });
        }
        break;
      case "Event": {
        const parameter = event?.parameter;
        if (!parameter?.name || parameter.event === undefined) {
          errors.push({
            path: at,
            message: "must be in the body of a function with an event parameter (ADR-0047)",
          });
          break;
        }
        if (!isMemberOf(text, parameter.name, ref.member)) {
          errors.push({
            path: `${at}/span`,
            message: `must span "${parameter.name}.${ref.member}"`,
          });
        } else if (!PORTABLE_EVENT_MEMBERS.get(parameter.event)?.has(ref.member)) {
          errors.push({
            path: `${at}/member`,
            message: `must be a member every target's ${parameter.event} has (\`PORTABLE_EVENT_MEMBERS\`), and "${ref.member}" is not one`,
          });
        } else if (EVENT_METHODS.has(ref.member) !== (ref.call === true)) {
          errors.push({
            path: `${at}/call`,
            message: EVENT_METHODS.has(ref.member)
              ? `must be set: "${ref.member}" is a method, which code only calls`
              : `must be absent: "${ref.member}" is not a method`,
          });
        }
        break;
      }
      case "Slot":
        errors.push({
          path: at,
          message: `must not test a slot's presence in ${CONTEXT_NAMES[context]}: only a template does (ADR-0054)`,
        });
        break;
      default:
        unreachable(ref);
    }
  }
}

/** Checks an emit (ADR-0047): of the component's `emit`, a declared event, its arguments' count. */
function checkEmit(
  ref: Extract<Code["refs"][number], { kind: "Emit" }>,
  text: string,
  path: string,
  context: Context,
  walk: Walk,
): void {
  const { errors } = walk;
  if (context !== "client") {
    errors.push({
      path,
      message: `must not emit in ${CONTEXT_NAMES[context]}: only client code emits (ADR-0047)`,
    });
  }
  const { emits } = walk.component;
  const binding = walk.bindings.get(ref.binding);
  if (!emits || ref.binding !== emits.binding || binding?.kind !== "emit") {
    errors.push({
      path: `${path}/binding`,
      message: `must name the \`emit\` that \`emits\` declares, and "${ref.binding}" is not it`,
    });
  } else if (!text.startsWith(binding.name)) {
    errors.push({ path: `${path}/span`, message: `must span the call of "${binding.name}"` });
  }
  const declared = emits?.events.find(({ name }) => name === ref.event);
  if (!declared) {
    errors.push({
      path: `${path}/event`,
      message: `must name an event the component declares, and "${ref.event}" is not one`,
    });
  } else {
    const required = declared.parameters.filter((parameter) => !parameter.optional).length;
    const count = ref.arguments.length;
    if (count < required || count > declared.parameters.length) {
      errors.push({
        path: `${path}/arguments`,
        message: `must pass ${required === declared.parameters.length ? required : `${required} to ${declared.parameters.length}`} arguments to "${ref.event}", and passes ${count}`,
      });
    }
  }
  let end = ref.span.start;
  for (const [index, argument] of ref.arguments.entries()) {
    if (!inside(argument, ref.span) || argument.start < end || argument.start >= argument.end) {
      errors.push({
        path: `${path}/arguments/${index}`,
        message: "must lie in the emit, after the argument before it",
      });
    }
    end = Math.max(end, argument.end);
  }
}

/** How many parameters each role takes, and whether they may be rest parameters or default. */
const PARAMETERS: Readonly<Record<FunctionRole, { max: number; plain: boolean; what: string }>> = {
  getter: { max: 0, plain: true, what: "a getter takes none" },
  lifecycle: { max: 0, plain: true, what: "a lifecycle hook takes none" },
  watchEffect: { max: 1, plain: true, what: "`watchEffect` passes `onCleanup` alone" },
  watch: {
    max: 3,
    plain: true,
    what: "a watcher passes the value, the previous value and `onCleanup`",
  },
  handler: { max: 1, plain: true, what: "a handler is passed the event alone" },
  function: { max: Number.POSITIVE_INFINITY, plain: false, what: "" },
};

/**
 * Checks a function the source writes (ADR-0045, ADR-0047): its parts lie in it in order; its
 * parameters are what its role takes, named apart from the component's names, with static
 * defaults and one event parameter at most, a handler's or a setup function's; `expression`
 * says whether the body is an expression; its event controls are its body's calls; and its body
 * is code of its context.
 */
function checkFunction(
  fn: FunctionCode,
  path: string,
  scope: ReadonlySet<BindingId>,
  role: FunctionRole,
  walk: Walk,
): void {
  const { errors } = walk;
  const context: Context = role === "getter" ? "getter" : "client";
  const { body } = fn;
  if (!inside(body.span, fn.span)) {
    errors.push({ path: `${path}/body/span`, message: "must lie in the function" });
  }
  if ((fn.expression === true) === body.code.startsWith("{")) {
    errors.push({
      path: `${path}/expression`,
      message: fn.expression
        ? "must be absent: the body is a block (an object literal body is parenthesised)"
        : "must be set: the body is an expression, not a block",
    });
  }
  if (fn.async && role === "getter") {
    errors.push({ path: `${path}/async`, message: "must be absent: a getter is pure" });
  }
  if (fn.returnType) {
    checkSourceText(fn.returnType, `${path}/returnType`, errors);
    if (!inside(fn.returnType.span, fn.span) || fn.returnType.span.end > body.span.start) {
      errors.push({
        path: `${path}/returnType/span`,
        message: "must lie in the function, before its body",
      });
    }
  }
  const limits = PARAMETERS[role];
  if (fn.parameters.length > limits.max) {
    errors.push({
      path: `${path}/parameters`,
      message: `must hold at most ${limits.max}: ${limits.what}`,
    });
  }
  const names = new Set<string>();
  let event: Parameter | undefined;
  let end = fn.span.start;
  for (const [index, parameter] of fn.parameters.entries()) {
    const at = `${path}/parameters/${index}`;
    if (parameter.span.start < end || parameter.span.end > body.span.start) {
      errors.push({
        path: `${at}/span`,
        message: "must lie in the function, after the parameter before it and before the body",
      });
    }
    end = Math.max(end, parameter.span.end);
    checkParameter(parameter, at, index === fn.parameters.length - 1, names, scope, walk);
    if (limits.plain && (parameter.rest || parameter.default)) {
      errors.push({ path: at, message: `must be a plain parameter: ${limits.what}` });
    }
    if (parameter.event !== undefined) {
      if (role !== "handler" && role !== "function") {
        errors.push({
          path: `${at}/event`,
          message: "must be absent: only a handler's or a setup function's parameter is an event",
        });
      } else if (event) {
        errors.push({ path: `${at}/event`, message: "must be absent: a function takes one event" });
      } else if (parameter.name === undefined || parameter.rest) {
        errors.push({
          path: `${at}/event`,
          message: "must be absent: an event parameter is an identifier, read as `event.member`",
        });
      } else if (!EVENT_INTERFACES.has(parameter.event)) {
        errors.push({
          path: `${at}/event`,
          message: `must be an event interface of the vocabulary (\`EVENT_INTERFACES\`), and "${parameter.event}" is not one`,
        });
      } else {
        event = parameter;
      }
    } else if (role === "handler") {
      errors.push({
        path: `${at}/event`,
        message: "must be set: a handler's parameter is its event's",
      });
    }
  }
  checkCode(body, `${path}/body`, scope, context, walk, event ? { parameter: event } : undefined);
  checkEventControls(fn, path, event, walk);
  // A write that is an arrow's whole expression body says so, for the targets that rewrite it
  // into a statement (ADR-0045).
  if (fn.expression) {
    const whole = body.refs.find(
      (ref) => ref.span.start === body.span.start && ref.span.end === body.span.end,
    );
    if (whole?.kind === "Write" && !whole.arrowBody) {
      errors.push({
        path: `${path}/body/refs/${body.refs.indexOf(whole)}/arrowBody`,
        message: "must be set: the write is the arrow's whole body",
      });
    }
  }
}

/**
 * Checks a parameter: an identifier or a pattern, whose names are identifiers no other parameter,
 * component name, loop variable around it or output takes (UF3024); a static default; and the
 * flags TypeScript allows together.
 */
function checkParameter(
  parameter: Parameter,
  path: string,
  last: boolean,
  names: Set<string>,
  scope: ReadonlySet<BindingId>,
  walk: Walk,
): void {
  const { errors } = walk;
  const { pattern } = parameter;
  if ((parameter.name === undefined) === (pattern === undefined)) {
    errors.push({ path, message: "must have a name or a pattern, and not both" });
    return;
  }
  if (pattern) {
    checkSourceText(pattern, `${path}/pattern`, errors);
    if (!inside(pattern.span, parameter.span)) {
      errors.push({ path: `${path}/pattern/span`, message: "must lie in the parameter" });
    }
  }
  const declared = parameter.name === undefined ? pattern!.names : [parameter.name];
  for (const [index, name] of declared.entries()) {
    const at = parameter.name === undefined ? `${path}/pattern/names/${index}` : `${path}/name`;
    const taken = isIdentifier(name)
      ? names.has(name)
        ? "another parameter of the function takes it"
        : takenName(name, scope, walk)
      : "it is not an ASCII identifier";
    if (taken) errors.push({ path: at, message: `must not be named "${name}": ${taken}` });
    names.add(name);
  }
  if (parameter.type) checkSourceText(parameter.type, `${path}/type`, errors);
  if (parameter.default) {
    checkSourceText(parameter.default, `${path}/default`, errors);
    if (parameter.default.refs.length) {
      errors.push({ path: `${path}/default/refs`, message: "must be empty: a default is static" });
    }
    if (parameter.optional || parameter.rest) {
      errors.push({
        path: `${path}/default`,
        message: "must be absent on an optional or a rest parameter",
      });
    }
  }
  if (parameter.rest && (!last || parameter.optional)) {
    errors.push({
      path: `${path}/rest`,
      message: "must be absent but on the last parameter, which is not optional",
    });
  }
}

/**
 * Checks a function's event controls (ADR-0047, UF3033): only with an event parameter, in order,
 * in its body, each spanning a call of its method, a condition that is the body's code there and
 * reads only the event; and every such call of the body among them.
 */
function checkEventControls(
  fn: FunctionCode,
  path: string,
  event: Parameter | undefined,
  walk: Walk,
): void {
  const { errors } = walk;
  const { body } = fn;
  const controls = fn.eventControls ?? [];
  if (controls.length && !event) {
    errors.push({
      path: `${path}/eventControls`,
      message: "must be absent on a function without an event parameter",
    });
    return;
  }
  let end = body.span.start;
  for (const [index, control] of controls.entries()) {
    const at = `${path}/eventControls/${index}`;
    if (!inside(control.span, body.span) || control.span.start < end) {
      errors.push({
        path: `${at}/span`,
        message: "must lie in the body, after the control before it",
      });
    }
    end = Math.max(end, control.span.end);
    const calls = body.refs.some(
      (ref) =>
        ref.kind === "Event" &&
        ref.call &&
        ref.member === control.method &&
        inside(ref.span, control.span),
    );
    if (!calls) {
      errors.push({ path: `${at}/span`, message: `must hold the call of \`${control.method}\`` });
    }
    const { condition } = control;
    if (!condition) continue;
    const refs = body.refs.filter((ref) => inside(ref.span, condition.span));
    if (
      !inside(condition.span, control.span) ||
      slice(body, condition.span) !== condition.code ||
      JSON.stringify(refs) !== JSON.stringify(condition.refs)
    ) {
      errors.push({
        path: `${at}/condition`,
        message: "must be the body's code at its span, with the body's references there",
      });
    } else if (condition.refs.some((ref) => ref.kind !== "Event")) {
      errors.push({
        path: `${at}/condition/refs`,
        message:
          "must read only the event: Qwik runs the condition apart from the handler, synchronously",
      });
    }
  }
}

/**
 * Checks a component's setup (ADR-0045): its items in source order, inside the component and
 * before its render; each declares one binding of its kind, which no other item declares; and
 * each item's code is what its context allows, reading only what is declared before it where it
 * runs during the setup, safe on the server where Vue runs it there, and reading no DOM where it
 * runs before the DOM updates (ADR-0048).
 */
function checkSetup(
  component: UfComponent,
  path: string,
  scope: ReadonlySet<BindingId>,
  walk: Walk,
): void {
  const { errors, bindings } = walk;
  const owners = new Map<BindingId, number>();
  let end = component.span.start;
  for (const [index, item] of component.setup.entries()) {
    const at = `${path}/setup/${index}`;
    if (item.span.start < end) {
      errors.push({ path: `${at}/span`, message: "must follow the item before it" });
    } else if (!inside(item.span, component.span) || item.span.end > component.render.span.start) {
      errors.push({ path: `${at}/span`, message: "must lie in the component, before its render" });
    }
    end = Math.max(end, item.span.end);
    const kind = ITEM_BINDINGS[item.kind];
    if (kind !== undefined && "binding" in item) {
      const binding = bindings.get(item.binding);
      if (binding?.kind !== kind) {
        errors.push({
          path: `${at}/binding`,
          message: `must name a ${kind} binding, and "${item.binding}" is not one`,
        });
      } else if (!inside(binding.span, item.span)) {
        errors.push({ path: `${at}/binding`, message: "must name a binding the item declares" });
      }
      owners.set(item.binding, (owners.get(item.binding) ?? 0) + 1);
    }
    if ("type" in item && item.type) checkSourceText(item.type, `${at}/type`, errors);
    checkItem(item, at, scope, walk);
  }
  for (const [index, binding] of component.bindings.entries()) {
    if (SETUP_KINDS.has(binding.kind) && owners.get(binding.id) !== 1) {
      errors.push({
        path: `${path}/bindings/${index}`,
        message: `must be declared by one setup item, and "${binding.id}" is by ${owners.get(binding.id) ?? 0}`,
      });
    }
  }
}

/** Checks a setup item's code and the rules of its kind. */
function checkItem(item: SetupItem, path: string, scope: ReadonlySet<BindingId>, walk: Walk): void {
  const { errors, component } = walk;
  switch (item.kind) {
    case "State":
    case "Variable":
      if (item.initial) {
        checkCode(item.initial, `${path}/initial`, scope, "initial", walk);
        declaredBefore(summarizeCode(item.initial, component), item, `${path}/initial`, walk);
      }
      return;
    case "Const":
      checkCode(item.value, `${path}/value`, scope, "initial", walk);
      declaredBefore(summarizeCode(item.value, component), item, `${path}/value`, walk);
      return;
    case "TemplateRef":
    case "Id":
      return;
    case "Derived":
      checkFunction(item.getter, `${path}/getter`, scope, "getter", walk);
      declaredBefore(summarizeCode(item.getter.body, component), item, `${path}/getter`, walk);
      return;
    case "Function": {
      const fn = item.function;
      checkFunction(fn, `${path}/function`, scope, "function", walk);
      if (item.form === "declaration" && fn.expression) {
        errors.push({
          path: `${path}/form`,
          message: 'must be "arrow": a function declaration has a block body',
        });
      }
      // Its value would be what a write or an emit returns, which the targets do not agree on.
      const whole = fn.expression
        ? fn.body.refs.find(
            (ref) => ref.span.start === fn.body.span.start && ref.span.end === fn.body.span.end,
          )
        : undefined;
      if (whole?.kind === "Write" || whole?.kind === "Emit") {
        errors.push({
          path: `${path}/function/body`,
          message: `must be a block: a setup function returns no ${whole.kind === "Write" ? "write" : "emit"} (ADR-0045)`,
        });
      }
      if (walk.summaries.get(item.binding)?.reaches.has(item.binding)) {
        errors.push({
          path: `${path}/binding`,
          message: `must not call itself, directly or through other local functions: Qwik's QRLs cannot (ADR-0045)`,
        });
      }
      return;
    }
    case "Watch":
      checkWatch(item, path, scope, walk);
      return;
    case "WatchEffect": {
      checkFunction(item.effect, `${path}/effect`, scope, "watchEffect", walk);
      // What runs later (a timer's callback, `onCleanup`'s) is tracked by no target.
      const summary = summarizeTracked(item.effect.body, component);
      if (summary.readsLocalVar || summary.readsTemplateRef) {
        errors.push({
          path: `${path}/effect`,
          message: `must read no ${summary.readsLocalVar ? "setup `let`" : "template ref"} while it runs, itself or through its functions: neither is reactive on every target (ADR-0048)`,
        });
      }
      return;
    }
    case "Lifecycle":
      checkFunction(item.callback, `${path}/callback`, scope, "lifecycle", walk);
      return;
    case "Model":
      if (component.props.some(({ name }) => name === item.name)) {
        errors.push({
          path: `${path}/name`,
          message: `must differ from every prop's name, and "${item.name}" is a prop's`,
        });
      } else if (
        component.setup.some(
          (other) => other !== item && other.kind === "Model" && other.name === item.name,
        )
      ) {
        errors.push({
          path: `${path}/name`,
          message: `must declare the model "${item.name}" once`,
        });
      }
      if (item.default) {
        if (item.default.refs.length) {
          errors.push({
            path: `${path}/default/refs`,
            message: "must be empty: a model's default is static, as a prop's is",
          });
        }
        checkSourceText(item.default, `${path}/default`, errors);
      }
      return;
    case "Provide":
      checkKeyName(item.key, `${path}/key`, walk);
      if (walk.keys.get(item.key)) checkProvidedRef(item.value, `${path}/value`, walk);
      else checkCode(item.value, `${path}/value`, scope, "initial", walk);
      declaredBefore(summarizeCode(item.value, component), item, `${path}/value`, walk);
      return;
    case "Inject":
      checkKeyName(item.key, `${path}/key`, walk);
      if (item.fallback) {
        if (walk.keys.get(item.key)) checkProvidedRef(item.fallback, `${path}/fallback`, walk);
        else checkCode(item.fallback, `${path}/fallback`, scope, "initial", walk);
        declaredBefore(summarizeCode(item.fallback, component), item, `${path}/fallback`, walk);
      }
      return;
    default:
      unreachable(item);
  }
}

/** Checks a watcher (ADR-0048): its sources, its callback, and when the callback runs. */
function checkWatch(
  item: Extract<SetupItem, { kind: "Watch" }>,
  path: string,
  scope: ReadonlySet<BindingId>,
  walk: Walk,
): void {
  const { errors, bindings, component } = walk;
  if (item.array ? !item.sources.length : item.sources.length !== 1) {
    errors.push({
      path: `${path}/sources`,
      message: item.array
        ? "must hold a source: an array of sources is not empty"
        : "must hold one source, or `array` be set",
    });
  }
  for (const [index, source] of item.sources.entries()) {
    const at = `${path}/sources/${index}`;
    if (source.kind === "Ref") {
      const binding = bindings.get(source.binding);
      if (
        (binding?.kind !== "state" && binding?.kind !== "derived") ||
        !scope.has(source.binding)
      ) {
        errors.push({
          path: `${at}/binding`,
          message: `must name a state or a derived value, and "${source.binding}" is not one`,
        });
      } else if (binding.span.start >= item.span.start) {
        errors.push({
          path: `${at}/binding`,
          message: `must watch what is declared before the watcher, and "${binding.id}" is not: the setup reads it at once (ADR-0045)`,
        });
      }
    } else {
      checkFunction(source.getter, `${at}/getter`, scope, "getter", walk);
      declaredBefore(summarizeCode(source.getter.body, component), item, `${at}/getter`, walk);
    }
  }
  checkFunction(item.callback, `${path}/callback`, scope, "watch", walk);
  const summary = summarizeCode(item.callback.body, component);
  if (item.immediate && item.post) {
    errors.push({
      path: `${path}/post`,
      message:
        "must be absent on an immediate watcher: its first callback runs during the setup, before any DOM (ADR-0048)",
    });
  } else if (item.immediate) {
    const problem = serverProblem(summary, item.callback.async === true, walk);
    if (problem) {
      errors.push({
        path: `${path}/callback`,
        message: `must be safe on the server, as Vue runs an immediate watcher's first callback there, and ${problem} (ADR-0048)`,
      });
    }
    declaredBefore(summary, item, `${path}/callback`, walk);
  } else if (!item.post) {
    const early = beforeTick(item.callback.body);
    const summary = summarizeCode(early, component);
    const dom = domGlobal(early, summary, component);
    if (summary.readsTemplateRef || dom !== undefined) {
      errors.push({
        path: `${path}/post`,
        message: `must be set: the callback reads the DOM (${dom === undefined ? "a template ref" : `\`${dom}\``}) before \`await nextTick()\`, which a watcher sees updated only after it (ADR-0048)`,
      });
    }
  }
}

/**
 * The first global code reads, itself or through the local functions it reaches, that sees the
 * DOM a render changes (`readsDom`: `document`, `window`'s layout, `getComputedStyle`), or
 * `undefined`.
 */
function domGlobal(code: Code, summary: CodeSummary, component: UfComponent): string | undefined {
  const reached = component.setup.flatMap((item) =>
    item.kind === "Function" && summary.reaches.has(item.binding) ? [item.function.body] : [],
  );
  for (const each of [code, ...reached]) {
    for (const ref of each.refs) {
      const following = each.code.slice(ref.span.end - each.span.start);
      if (ref.kind === "Global" && readsDom(ref.name, following)) return ref.name;
    }
  }
  return undefined;
}

/**
 * A callback's code up to its first `await nextTick()`, after which the DOM has updated on every
 * target (ADR-0007). The analyser counts only an `await` every path to the read passes (UF2018);
 * the IR, which holds no statements, takes the first one in the text.
 */
function beforeTick(code: Code): Code {
  const tick = code.refs.find(
    (ref) =>
      ref.kind === "Api" &&
      /(?<![\w$])await\s*$/.test(code.code.slice(0, ref.span.start - code.span.start)),
  );
  return tick
    ? { ...code, refs: code.refs.filter((ref) => ref.span.start < tick.span.start) }
    : code;
}

/**
 * Why code Vue may run during the server's setup is not safe there, or `undefined`: it writes
 * state, reads a template ref, reads a browser or a scheduling global, awaits or calls
 * `nextTick` (ADR-0048).
 */
function serverProblem(summary: CodeSummary, async: boolean, walk: Walk): string | undefined {
  const state = [...summary.writes].find((id) => walk.bindings.get(id)?.kind === "state");
  if (state !== undefined) return `it writes "${state}"`;
  if (summary.readsTemplateRef) return "it reads a template ref";
  const global = [...summary.clientGlobals].find(
    (name) => BROWSER_GLOBALS.has(name) || SCHEDULING_GLOBALS.has(name),
  );
  if (global !== undefined) return `it reads \`${global}\``;
  if (async || summary.async) return "it is asynchronous";
  if (summary.api) return "it calls `nextTick`";
  return undefined;
}

/**
 * Checks that code the setup runs reads only what is declared before its item (ADR-0045): the
 * bindings it reads and calls, itself or through its functions, and `emit` if it emits. React's
 * and Solid's outputs evaluate it where the item is, before a later declaration. A `function`
 * declaration is hoisted: only what it reads and reaches counts, which the summary holds.
 */
function declaredBefore(summary: CodeSummary, item: SetupItem, path: string, walk: Walk): void {
  const { emits, setup } = walk.component;
  const hoisted = new Set(
    setup.flatMap((each) =>
      each.kind === "Function" && each.form === "declaration" ? [each.binding] : [],
    ),
  );
  const used = [...summary.reads, ...summary.reaches].filter((id) => !hoisted.has(id));
  if (summary.emits.size && emits) used.push(emits.binding);
  for (const id of used) {
    const binding = walk.bindings.get(id);
    if (binding && binding.kind !== "prop" && binding.span.start >= item.span.start) {
      walk.errors.push({
        path,
        message: `must read only what is declared before it, and "${id}" is not: the setup runs it where it is (ADR-0045)`,
      });
      return;
    }
  }
}

/**
 * Checks the events a component declares (ADR-0047, ADR-0012): the one `emit` binding, declared
 * by `emits`, inside the component before its render; events whose names Svelte's lower case
 * keeps apart, which do not start as an event prop does (angular-eslint's
 * `no-output-on-prefix`), and which no prop or setup binding takes, nor a prop takes as Svelte
 * spells the event's prop (`onchange`); payloads of named members, the optional ones last.
 */
function checkEmits(component: UfComponent, path: string, walk: Walk): void {
  const { errors, bindings } = walk;
  const { emits } = component;
  for (const [index, binding] of component.bindings.entries()) {
    if (binding.kind === "emit" && binding.id !== emits?.binding) {
      errors.push({
        path: `${path}/bindings/${index}`,
        message: `must be the binding \`emits\` declares, and "${binding.id}" is not`,
      });
    }
  }
  if (!emits) return;
  const at = `${path}/emits`;
  checkDeclaredEmits(emits, at, walk);
  const binding = bindings.get(emits.binding);
  if (binding?.kind !== "emit") {
    errors.push({
      path: `${at}/binding`,
      message: `must name an emit binding, and "${emits.binding}" is not one`,
    });
  } else if (!inside(binding.span, emits.span)) {
    errors.push({
      path: `${at}/binding`,
      message: "must name the binding the declaration declares",
    });
  }
  if (!inside(emits.span, component.span) || emits.span.end > component.render.span.start) {
    errors.push({ path: `${at}/span`, message: "must lie in the component, before its render" });
  } else if (component.setup.some(({ span }) => overlaps(span, emits.span))) {
    errors.push({ path: `${at}/span`, message: "must lie apart from the setup's items" });
  }
  checkSourceText(emits.type, `${at}/type`, errors);
}

/**
 * What follows `nextTick` where it is called as its one form (ADR-0048, UF2025): `()` or `?.()`,
 * with only whitespace and comments around and inside the parentheses.
 */
const CALLED_BARE =
  /^(?:\s|\/\*[\s\S]*?\*\/|\/\/[^\n]*)*(?:\?\.(?:\s|\/\*[\s\S]*?\*\/|\/\/[^\n]*)*)?\((?:\s|\/\*[\s\S]*?\*\/|\/\/[^\n]*)*\)/;

/** Checks the declared events' names and payloads. */
function checkDeclaredEmits(emits: Emits, path: string, walk: Walk): void {
  const { errors, component } = walk;
  const lower = new Map<string, string>();
  let end = -1;
  for (const [index, event] of emits.events.entries()) {
    const at = `${path}/events/${index}`;
    const { name } = event;
    const other = lower.get(name.toLowerCase());
    // A setup binding may share an event's name: Angular's output, which declares a member of
    // each, aliases its output (ADR-0047). A prop, public on every target, may not.
    const owner = component.props.some((prop) => prop.name === name)
      ? `the prop "${name}"`
      : undefined;
    const svelte = component.props.find((prop) => prop.name === `on${name.toLowerCase()}`);
    const reserved = reservedEventName(name);
    const problem =
      other !== undefined
        ? other === name
          ? `must declare "${name}" once`
          : `must differ from "${other}" by more than case: Svelte lower-cases event names`
        : /^on([^a-z]|$)/.test(name)
          ? `must not be named as an event prop, and "${name}" is: angular-eslint's \`no-output-on-prefix\` rejects it`
          : reserved
            ? `must not be "${name}", which Angular's output declares as a member its templates read: ${reserved}`
            : owner
              ? `must differ from ${owner}'s name: Angular's output declares a member of each`
              : svelte
                ? `must not be "${name}": Svelte names its prop "${svelte.name}", which a prop takes`
                : undefined;
    if (problem) errors.push({ path: `${at}/name`, message: problem });
    lower.set(name.toLowerCase(), name);
    if (event.span.start < end) {
      errors.push({ path: `${at}/span`, message: "must follow the event before it" });
    }
    end = event.span.end;
    const members = new Set<string>();
    let optional = false;
    for (const [position, parameter] of event.parameters.entries()) {
      const member = `${at}/parameters/${position}`;
      if (!isIdentifier(parameter.name) || members.has(parameter.name)) {
        errors.push({
          path: `${member}/name`,
          message: `must be an identifier no other member takes, and "${parameter.name}" is not`,
        });
      }
      members.add(parameter.name);
      if (optional && !parameter.optional) {
        errors.push({
          path: `${member}/optional`,
          message: "must be set: a required member cannot follow an optional one",
        });
      }
      optional ||= parameter.optional === true;
      checkSourceText(parameter.type, `${member}/type`, errors);
    }
  }
}

/** Whether `span` lies in `outer`. */
function inside(span: Span, outer: Span): boolean {
  return span.start >= outer.start && span.end <= outer.end;
}

/** Whether two spans share a character. */
function overlaps(a: Span, b: Span): boolean {
  return a.start < b.end && b.start < a.end;
}

/** The text of code at a span inside it. */
function slice(code: Code, span: Span): string {
  return code.code.slice(span.start - code.span.start, span.end - code.span.start);
}

/**
 * Whether a reference's text reads `member` of the object `object`: `object.member`, with only
 * whitespace and comments around the dot.
 */
function isMemberOf(text: string, object: string, member: string): boolean {
  if (!text.startsWith(object) || !text.endsWith(member)) return false;
  const between = text.slice(object.length, text.length - member.length);
  return between.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*(?:\n|$)|\s+/g, "") === ".";
}

/**
 * Checks that a copied text is as long as its span, the source it was copied from. Returns
 * whether it is, so offsets into it can be read.
 */
function checkSourceText(
  text: { code: string; span: Span },
  path: string,
  errors: IrValidationError[],
): boolean {
  const length = text.span.end - text.span.start;
  if (text.code.length === length) return true;
  errors.push({
    path: `${path}/code`,
    message: `must be the source at its span, ${length} characters, and is ${text.code.length}`,
  });
  return false;
}

/** Why the targets would render an attribute differently on its element, whatever its value. */
function unportableAttribute(
  tag: string,
  name: string,
  type: string | undefined,
  hasChildren: boolean,
): string | undefined {
  if (DOCUMENT_ATTRIBUTES.has(name)) {
    return `\`${name}\` holds an HTML document, which the compiler cannot analyse`;
  }
  const reason = TEMPLATE_SYNTAX_ATTRIBUTES.get(name) ?? UNRENDERED_ATTRIBUTES.get(name);
  if (reason) return reason;
  if (isStateAttribute(tag, name, type)) {
    return `\`${name}\` is the state of the <${tag}>, which some targets set as its DOM property and others as the attribute`;
  }
  const childless = CHILDLESS_ATTRIBUTES.get(name);
  return hasChildren && childless
    ? `\`${name}\` on an element with children: ${childless}`
    : undefined;
}

/** Why a value is one the targets render differently, or code the compiler cannot analyse. */
function valueProblem(
  tag: string,
  namespace: Namespace,
  name: string,
  value: string,
): string | undefined {
  if (name === "class" && !CANONICAL_CLASS.test(value)) {
    return "must be class names separated by single spaces";
  }
  // Angular merges a static `class` with a bound one through the class list, which drops a
  // repeated name that the other targets keep (ADR-0038).
  const repeated =
    name === "class"
      ? value.split(" ").find((item, index, all) => all.indexOf(item) !== index)
      : undefined;
  if (repeated !== undefined) return `must name the class "${repeated}" once`;
  const unanalysable = unanalysableUrl(tag, name, value);
  if (unanalysable === "javascript") return "must not be a `javascript:` URL";
  if (unanalysable === "data") {
    return `must not be a \`data:\` URL: <${tag}> loads it as a document, which the compiler cannot analyse`;
  }
  if (isDroppedEmptyUrl(tag, name, value)) {
    return `must not be empty: React drops an empty \`${name}\` on <${tag}>`;
  }
  const numeric = namespace === "html" ? NUMERIC_ATTRIBUTES.get(tag)?.get(name) : undefined;
  if (numeric && canonicalNumber(value, numeric) !== value) {
    const { kind, max } = numeric;
    return `must be a canonical ${kind}${max === undefined ? "" : ` up to ${max}`}, as renderers that set the DOM property write it, and "${value}" is not`;
  }
  // React and Qwik type it as a number, so they write it as a number literal (ADR-0037).
  const numberTyped = isNumberTypedAttribute(namespace === "html" ? tag : "", name);
  if (numberTyped && String(Number(value)) !== value) {
    return `must be a number in canonical form, which React and Qwik write as a number literal, and "${value}" is not`;
  }
  return undefined;
}

/** Reports the first character of a string that HTML would not keep as written. */
function checkCharacters(value: string, path: string, errors: IrValidationError[]): void {
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    const problem = unkeptCharacter(codePoint);
    if (!problem) continue;
    const name = `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
    errors.push({
      path,
      message: `must hold only characters HTML keeps, and ${name} (${problem}) is not one`,
    });
    return;
  }
}

/** The `never` default of an exhaustive switch: a kind added to a union fails type checking. */
function unreachable(value: never): never {
  throw new Error(`Unexpected IR value: ${JSON.stringify(value)}`);
}
