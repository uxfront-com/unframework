// A component as a `.gts` module (plan §6): the imports, the copied types, the signature, then a
// template-only component or a `@glimmer/component` class. Glimmer templates hold paths, literals
// and helper calls, never JavaScript, so every other expression the template reads becomes a
// member of the class: a getter, or a function the template calls with the row variables it
// reads (`{{this.label item}}`).
import {
  addTypeImports,
  childImports,
  componentTypes,
  directiveSpecifier,
  exportsOf,
  expressionNames,
  functionBodyText,
  functionText,
  importedDirectives,
  ImportSet,
  keyImports,
  keyOwner,
  parametersText,
  passThroughImports,
  ownDirectives,
  printMarkup,
  printProgram,
  rewriteCode as rewrite,
  rewriteExpression,
  staticStyleValue,
  typeDeclarationCode,
  typeExportsCode,
} from "@unframework.dev/codegen";
import type {
  ChildImport,
  ClassPart,
  OutputFile,
  MarkupPiece,
  EmitContext,
  RewriteRules,
  StylePart,
} from "@unframework.dev/codegen";
import { js } from "@unframework.dev/codegen";
import type {
  Binding,
  BindingReference,
  ComponentNode,
  ElementNode,
  EventAttribute,
  Expression,
  FunctionCode,
  IfBranch,
  IfNode,
  InjectionKeyDeclaration,
  ListenerAttribute,
  Code,
  ModelAttribute,
  ModelBindingAttribute,
  Prop,
  SlotFill,
  SlotOutletNode,
  TeleportNode,
  TransitionNode,
  TypeDeclaration,
  UfComponent,
  UfComposable,
  UfModule,
  UseItem,
} from "@unframework.dev/ir";

import { emberDialect } from "./dialect.ts";
import { DIRECTIVE_IMPORTS, directiveDeclaration, directiveHelpers } from "./directive.ts";
import {
  FALLTHROUGH_STYLE,
  fallthroughRoot,
  hasOwnStyle,
  rootNodes,
  styleLiteral,
  takesFallthrough,
} from "./fallthrough.ts";
import type { RootNode } from "./fallthrough.ts";
import { moduleReads } from "./modules.ts";
import type { ModuleReads } from "./modules.ts";
import { TRANSITION_HELPERS, TRANSITION_IMPORTS } from "./transition.ts";

/** A row variable a list's body reads: its name, and its type in the class's terms. */
interface RowVariable {
  name: string;
  type: string;
}

/** A member the template reads in place of an expression. */
interface Hoisted {
  name: string;
  parameters: readonly RowVariable[];
}

/** What a hoisted member holds: a value the template reads, or a listener `{{on}}` takes. */
type HoistedKind = "value" | "listener" | "initial";

/** Prints one component's `.gts` module. */
/** A composable of a `.uf.ts` module as its own module, `useToggle.ts` (ADR-0069). */
export function emitComposable(composable: UfComposable, context: EmitContext): OutputFile[] {
  const owner: UfComponent = {
    name: composable.name,
    span: composable.span,
    ...(composable.typeParameters ? { typeParameters: composable.typeParameters } : {}),
    props: [],
    types: composable.types,
    bindings: composable.bindings,
    setup: composable.setup,
    render: { kind: "Fragment", children: [], span: composable.span },
  };
  const plan = new ComponentPlan(owner, context.module, composable);
  return [{ path: `${composable.name}.ts`, contents: plan.printComposable() }];
}

export function emitComponent(component: UfComponent, context: EmitContext): string {
  const plan = new ComponentPlan(component, context.module);
  return plan.print();
}

/** A component's class: its members in order, and what the template reads through them. */
class ComponentPlan {
  readonly #component: UfComponent;
  readonly #module: UfModule;
  /** The members the template's expressions became, by their code and row variables. */
  readonly #hoisted = new Map<string, Hoisted>();
  /** How many members of each kind the template's expressions became. */
  readonly #counts: Record<HoistedKind, number> = { value: 0, listener: 0, initial: 0 };
  /** The printed members the template's expressions became, in template order. */
  readonly #hoistedMembers: string[] = [];
  /** Each row variable's type, by name, for the lists printed so far. */
  readonly #rows = new Map<string, string>();
  /** The list each row variable belongs to, by name. */
  readonly #rowLists = new Map<string, object>();
  /** The module helpers the members call. */
  readonly #helpers = new Set<HelperName>();
  #usesHtmlSafe = false;
  /** What the template calls before anything else: each watcher's `flush`. */
  readonly #before: string[] = [];
  /** What the template calls after everything else: each effect's `flush`, then the hooks. */
  readonly #after: string[] = [];
  /** Whether the setup holds a `watchEffect`, which runs again when what it reads notifies. */
  get #hasEffects(): boolean {
    return this.#component.setup.some((item) => item.kind === "WatchEffect");
  }
  /** What each scoped fill's name reads: its block param, or a key of it (`fills`). */
  readonly #slotScope = new Map<string, string>();
  /** The children whose signature a scoped fill's block param is typed by, by name. */
  readonly #signatures = new Map<string, ChildImport>();
  /** Whether the setup provides, and whether it injects (`provide`, `inject`). */
  readonly #provides: boolean;
  readonly #injects: boolean;
  /** The row variable of each transition's entries, by its node. */
  readonly #transitionEntries = new Map<TransitionNode, string>();
  /** The children the template renders, by the name it writes them with. */
  readonly #children: ReadonlyMap<string, ChildImport>;
  /** The events interface of each child an inline handler listens to, by the child's name. */
  readonly #eventTypes = new Map<string, { specifier: string; name: string; self: boolean }>();
  /** The tags the template writes. */
  readonly #tags: ReadonlySet<string>;
  /** Each node of the template, branch included, by what holds it. */
  readonly #parents: ReadonlyMap<object, object>;
  /** The nodes the root may be, which take the caller's attributes (`rootNodes`). */
  readonly #roots: readonly RootNode[];
  /** The one node a caller's `class` and `style` reach, if any (`fallthroughRoot`). */
  readonly #fallthrough: RootNode | undefined;

  /** Set where the plan writes a composable's class, not a component's (`emitComposable`). */
  readonly #composable: UfComposable | undefined;
  /** The hooks a composable's constructor registers with its caller (`#setupMembers`). */
  #composableHooks: string[] = [];
  /** What each composable's call keeps in a field, and the member each used binding reads. */
  readonly #used = new Map<string, { field: string; member: string }>();
  readonly #uses = new Map<UseItem, string>();

  constructor(component: UfComponent, module: UfModule, composable?: UfComposable) {
    this.#composable = composable;
    this.#component = component;
    this.#parents = parentsOf(component.render);
    this.#tags = tagsOf(component.render);
    this.#module = module;
    this.#children = new Map(
      childImports(component, module, (name) => `${name}.gts`).map((each) => [each.local, each]),
    );
    this.#roots = rootNodes(component, module);
    this.#fallthrough = fallthroughRoot(component, module);
    this.#provides = component.setup.some((item) => item.kind === "Provide");
    this.#injects = component.setup.some((item) => item.kind === "Inject");
    // Each call's result is a field named by its composable, `counter` for `useCounter`.
    const taken = new Set(component.bindings.map((each) => each.name));
    for (const item of component.setup) {
      if (item.kind !== "Use") continue;
      const imported =
        module.imports
          ?.flatMap((entry) => entry.names)
          .find((name) => name.kind === "Composable" && name.local === item.composable)?.imported ??
        item.composable;
      const stem = imported.replace(/^use/, "");
      let field = `${stem.charAt(0).toLowerCase()}${stem.slice(1)}`;
      while (taken.has(field)) field = `${field}_`;
      taken.add(field);
      this.#uses.set(item, field);
      for (const member of item.members) {
        this.#used.set(member.binding, { field, member: member.member });
      }
    }
  }

  /** How the class spells a reference to a binding: the same for every site. */
  get component(): UfComponent {
    return this.#component;
  }

  get rules(): RewriteRules {
    return {
      binding: (reference, binding) => this.#spell(reference, binding),
      import: (reference) => this.#local(reference.name),
      // Whether the parent filled a slot is a template keyword, `(has-block "title")`: a marker
      // that `value` writes as it.
      slot: (reference) => `${HAS_BLOCK}${reference.slot}__`,
      // Vue's `nextTick` resolves once its pending flush has run: Ember's is `renderSettled`.
      api: () => {
        this.#helpers.add("renderSettled");
        return "renderSettled";
      },
      // A parent listens to an event through an argument, `@onChange`, as Ember passes actions.
      emit: (emit, _binding, parts) =>
        `this.args.${eventArgument(emit.event)}?.(${parts.arguments.join(", ")})`,
    };
  }

  /**
   * A form control's `v-model`, as Vue's directives bind each control: the state shown through
   * the control's property, and a listener that writes it back. A field with a modifier, or a
   * number field, goes through `modelText`, Vue's `vModelText`.
   */
  model(attribute: ModelAttribute, value: string, element: ElementNode): string[] {
    const write = (code: string, parameters = "") =>
      this.#listener(`(${parameters}) => {\n  ${value} = ${code};\n}`, element);
    const target = (type: string, property: string) =>
      `(event.currentTarget as ${type}).${property}`;
    if (attribute.trim || attribute.lazy || attribute.number || attribute.control === "number") {
      this.#helpers.add("modelText");
      const setter = this.#listener(`(next: typeof ${value}) => {\n  ${value} = next;\n}`, element);
      const options = [
        attribute.trim ? " trim=true" : "",
        attribute.lazy ? " lazy=true" : "",
        attribute.number || attribute.control === "number" ? " number=true" : "",
      ].join("");
      // The first value, which the server renders: `modelText` shows the next ones.
      const initial = this.#hoist(value, "initial", element);
      return [
        `value={{this.${initial.name}}}`,
        `{{modelText ${this.value(value, true, element)} ${setter}${options}}}`,
      ];
    }
    switch (attribute.control) {
      case "text":
      case "textarea":
        return [
          `value={{${this.value(value, false, element)}}}`,
          `{{on "input" ${write(target(element.tag === "textarea" ? "HTMLTextAreaElement" : "HTMLInputElement", "value"), "event: Event")}}}`,
        ];
      case "checkbox":
        return [
          `checked={{${this.value(value, false, element)}}}`,
          `{{on "change" ${write(target("HTMLInputElement", "checked"), "event: Event")}}}`,
        ];
      case "radio": {
        const own = ownValue(element, this);
        return [
          `checked={{${this.value(`${value} === ${own}`, false, element)}}}`,
          `{{on "change" ${write(own)}}}`,
        ];
      }
      case "checkbox-group": {
        this.#helpers.add("toggle");
        const own = ownValue(element, this);
        return [
          `checked={{${this.value(`${value}.includes(${own})`, false, element)}}}`,
          `{{on "change" ${write(`toggle(${value}, ${own}, ${target("HTMLInputElement", "checked")})`, "event: Event")}}}`,
        ];
      }
      // Each option is `selected` where it holds the state (`optionSelected`), which the server
      // renders too.
      // A generic component's state may be a type parameter, `T extends string`, which an
      // option's string is not: the value is one of the options the parent passed.
      case "select": {
        const read = target("HTMLSelectElement", "value");
        const typed = this.#component.typeParameters ? `${read} as typeof ${value}` : read;
        return [`{{on "change" ${write(typed, "event: Event")}}}`];
      }
      case "select-multiple":
        return [
          `{{on "change" ${write(`Array.from(${target("HTMLSelectElement", "selectedOptions")}, (option) => option.value)`, "event: Event")}}}`,
        ];
      default:
        return attribute.control satisfies never;
    }
  }

  /** Whether an option of a `v-model`'s `<select>` holds the state: see the dialect. */
  optionSelected(element: ElementNode, value: string): string {
    let select: ElementNode | undefined;
    for (let node = this.#parents.get(element); node; node = this.#parents.get(node)) {
      if ((node as ElementNode).kind === "Element" && (node as ElementNode).tag === "select") {
        select = node as ElementNode;
        break;
      }
    }
    const model = select?.attributes.find((each): each is ModelAttribute => each.kind === "Model");
    if (!model) return "";
    const state = rewriteExpression(model.value, this.#component, this.rules, "render");
    const test =
      model.control === "select-multiple"
        ? `${state}.includes(${value})`
        : `String(${state}) === ${value}`;
    return ` selected={{${this.value(test, false, element)}}}`;
  }

  /** A listener's member for code, called with the row variables it reads. */
  #listener(code: string, at: object): string {
    const { name, parameters } = this.#hoist(code, "listener", at);
    if (!parameters.length) return `this.${name}`;
    return `(this.${name} ${parameters.map((each) => each.name).join(" ")})`;
  }

  /**
   * A child's `v-model:value`: the state as its `@value`, and `@onUpdateValue`, which writes the
   * child's writes back.
   */
  modelBinding(
    attribute: ModelBindingAttribute,
    value: string,
    component: ComponentNode,
  ): string[] {
    const write = this.#listener(`(next: typeof ${value}) => {\n  ${value} = next;\n}`, component);
    return [
      `@${attribute.model}={{${this.value(value, false, component, true)}}}`,
      `@${modelArgument(attribute.model)}={{${write}}}`,
    ];
  }

  /** The handler a template ref's modifier is given: the member that holds the element. */
  templateRef(name: string, element: ElementNode): string {
    // A child's ref is its `@ref` argument, which the child calls with what it exposes.
    if (this.isChild(element)) {
      this.#helpers.add("componentRef");
      return `@ref={{componentRef this "${name}"}}`;
    }
    this.#helpers.add("templateRef");
    return `{{templateRef this "${name}"}}`;
  }

  /** A directive's modifier on its element, with the value it takes (`directive`). */
  directive(name: string, value: string, element: ElementNode): string {
    return `{{${this.#local(name)} ${this.value(value, true, element, true)}}}`;
  }

  /**
   * The name a module value or a row variable takes in the template's scope. Glimmer reads a tag
   * named like a name in scope as that component (`<button>` with `button` imported), so a name
   * the template also writes as a tag takes another.
   */
  #local(name: string): string {
    const taken = (each: string) => this.#tags.has(each) || KEYWORDS.has(each);
    if (!taken(name)) return name;
    let local = `${name}_1`;
    for (let n = 2; taken(local); n++) local = `${name}_${n}`;
    return local;
  }

  #spell(reference: BindingReference, binding: Binding): string {
    switch (binding.kind) {
      case "prop": {
        const prop = this.#propOf(binding);
        return prop.default ? `this.${prop.name}` : `this.args.${prop.name}`;
      }
      case "loopVar":
        return this.#local(binding.name);
      // A scoped fill's name: a key of the props object its block param holds (`fills`).
      case "slotScope": {
        const path = this.#slotScope.get(binding.id);
        if (path === undefined) throw new Error(`No fill declares \`${binding.name}\`.`);
        return path;
      }
      case "state":
      case "derived":
      case "localConst":
      case "localFn":
      case "localVar":
        return `this.${binding.name}`;
      case "moduleConst":
      case "import":
      case "component":
        return binding.name;
      // A composable's parameter, which its class holds in `args`, as a component holds its own.
      case "argument":
        return `this.args.${binding.name}`;
      // A member of a composable's result, which the call's field holds.
      case "usedState":
      case "usedDerived":
      case "usedFn":
      case "usedConst": {
        const used = this.#used.get(binding.id);
        if (!used) throw new Error(`No composable's call gives \`${binding.name}\`.`);
        return `this.${used.field}.${used.member}`;
      }
      // A cached getter that reads the nearest provider's value (`#setupMembers`). The
      // reference to a key of a ref is the whole `count.value`.
      case "context": {
        const item = this.#component.setup.find(
          (each) => each.kind === "Inject" && each.binding === binding.id,
        );
        const ref = item?.kind === "Inject" && this.#key(item.key).ref;
        return ref ? `this.${binding.name}.value` : `this.${binding.name}`;
      }
      // Composition and context: a capability the cells leave unsupported, so the case has no
      // Ember output.
      default:
        return `this.${binding.name}`;
    }
  }

  #propOf(binding: Binding): Prop {
    const prop = this.#component.props.find((each) => each.binding === binding.id);
    if (!prop) throw new Error(`No prop binds ${binding.id}.`);
    return prop;
  }

  /**
   * The Glimmer expression for code: a path or a literal as written, or a member that holds the
   * code. `subexpression` writes a member call in parentheses, where Glimmer takes a value
   * (`{{#if (this.open item)}}`), and bare where a mustache calls it (`{{this.label item}}`).
   */
  value(code: string, subexpression: boolean, at?: object, typed = false): string {
    const literal = glimmerLiteral(code);
    if (literal !== undefined) return literal;
    const presence = new RegExp(`^(!?)${HAS_BLOCK}(\\w+)__$`).exec(code);
    if (presence) {
      const test = presence[2] === "default" ? "has-block" : `has-block "${presence[2]}"`;
      return presence[1] ? `(not (${test}))` : subexpression ? `(${test})` : test;
    }
    if (code.includes(HAS_BLOCK)) {
      throw new Error(
        `The ember target tests a slot's presence only as a whole condition: \`${code}\`.`,
      );
    }
    const conditions = this.#conditions(code, at);
    const path = this.#path(code);
    // Glint narrows a path under `{{#if}}` of a path, as TypeScript narrows the source; under any
    // other condition, a member reads the path under that condition.
    if (path !== undefined && conditions.every((each) => this.#narrowsAsPath(each))) return path;
    // Where a type checks the value, a child's argument, the other side is never read: the
    // branch holds wherever the template reads it.
    const otherwise = typed ? "(undefined as never)" : "undefined";
    const guarded = conditions.length
      ? `${conditions.map((each) => `(${each})`).join(" && ")} ? ${code} : ${otherwise}`
      : code;
    const { name, parameters } = this.#hoist(guarded, "value", at);
    if (!parameters.length) return `this.${name}`;
    const call = `this.${name} ${parameters.map((each) => each.name).join(" ")}`;
    return subexpression ? `(${call})` : call;
  }

  /** A path Glimmer reads as the code does, or `undefined`. */
  #path(code: string): string | undefined {
    // A non-null assertion asserts nothing a Glimmer path needs: it goes.
    const match = /^([A-Za-z_$][\w$]*)((?:!?\??\.[A-Za-z_$][\w$]*)*)!?$/.exec(code);
    if (!match) return undefined;
    const [, head, rest] = match;
    // Glimmer paths are nullish-safe on every segment, as `?.` is.
    const tail = rest!.replace(/!/g, "").replace(/\?\./g, ".");
    if (head === "this") {
      if (tail.startsWith(".args.")) return `@${tail.slice(".args.".length)}`;
      if (tail === "" || tail === ".args") return undefined;
      return `this${tail}`;
    }
    if (this.#rows.has(head!)) return `${head}${tail}`;
    return undefined;
  }

  /**
   * The conditions of the branches around code that read what it reads, which narrow it there
   * as they narrow the source. A member that holds the code reads it under them
   * (`uptime !== undefined ? uptime.toFixed(1) : undefined`): a getter is no branch, so
   * TypeScript would not narrow it otherwise.
   */
  #conditions(code: string, at: object | undefined): string[] {
    const reads = readPaths(code);
    const conditions: string[] = [];
    for (let node = at; node !== undefined; node = this.#parents.get(node)) {
      const branches = (this.#parents.get(node) as IfNode | undefined)?.branches;
      if (!branches || !(branches as readonly object[]).includes(node)) continue;
      const branch = node as IfBranch;
      const own: string[] = [];
      for (const each of branches) {
        if (each === branch) {
          if (each.condition) own.push(this.#condition(each.condition));
          break;
        }
        if (each.condition) own.push(`!(${this.#condition(each.condition)})`);
      }
      for (const condition of own.toReversed()) {
        if (readPaths(condition).some((path) => reads.includes(path)))
          conditions.unshift(condition);
      }
    }
    return conditions;
  }

  /** Whether the template's `{{#if}}` of a condition is a path, or its `{{else}}`. */
  #narrowsAsPath(condition: string): boolean {
    const negated = /^!\((.*)\)$/s.exec(condition)?.[1];
    return this.#path(negated ?? condition) !== undefined;
  }

  #condition(expression: Expression): string {
    return rewriteExpression(expression, this.#component, this.rules, "render");
  }

  /** The member that holds code, declared once for each code and row variables. */
  #hoist(
    code: string,
    kind: HoistedKind,
    at: object | undefined,
    own: ReadonlySet<string> = new Set(),
  ): Hoisted {
    const names = expressionNames(code);
    const parameters: RowVariable[] = [];
    for (const [name, type] of this.#rows) {
      if (names.has(name) && !own.has(name) && this.#inList(name, at)) {
        parameters.push({ name, type });
      }
    }
    const key = `${kind}\0${code}\0${parameters.map((each) => `${each.name}:${each.type}`).join(",")}`;
    const found = this.#hoisted.get(key);
    if (found) return found;
    const name = `${kind}${++this.#counts[kind]}`;
    const hoisted = { name, parameters };
    this.#hoisted.set(key, hoisted);
    const list = parameters.map((each) => `${each.name}: ${each.type}`).join(", ");
    // An arrow's object literal is parenthesised, or it reads as the arrow's block.
    const body = code.trimStart().startsWith("{") ? `(${code})` : code;
    // A listener is a field, so `{{on}}` gets the same function at each render, bound to the
    // instance. A value is a getter, which Glimmer reads again when what it reads changes.
    this.#hoistedMembers.push(
      parameters.length
        ? `${name} = (${list}) => ${body};`
        : kind === "listener"
          ? `${name} = ${code};`
          : kind === "initial"
            ? `readonly ${name} = ${code};`
            : `get ${name}() {\n  return ${code};\n}`,
    );
    return hoisted;
  }

  /** Whether a row variable is in scope at a node: the node is in its list. */
  #inList(name: string, at: object | undefined): boolean {
    const list = this.#rowLists.get(name);
    if (at === undefined || list === undefined) return true;
    for (let node: object | undefined = at; node !== undefined; node = this.#parents.get(node)) {
      if (node === list) return true;
    }
    return false;
  }

  /**
   * The handler of a listener: the setup function it names, or a member that holds the inline
   * one, called with the row variables it reads (`{{on "click" (this.listener1 item)}}`).
   */
  listener(attribute: EventAttribute, at: object): string {
    const { handler } = attribute;
    if (handler.kind === "Function") return `this.${bindingName(this.#component, handler.binding)}`;
    const fn = typedEvent(handler.function, `HTMLElementEventMap["${attribute.event}"]`);
    return this.#inline(fn, at);
  }

  /**
   * A component's fills (ADR-0054): the default slot's children between its tags, or each slot
   * as a named block, `<:header>…</:header>`, once any named one is there. A scoped fill takes
   * the props object as a block param, `as |slotProps|`, whose keys its names read.
   */
  fills(fills: readonly SlotFill[], node: ComponentNode): MarkupPiece[] {
    const named = fills.some(
      (fill) =>
        fill.slot !== "default" || fill.parameter !== undefined || this.#forwardsProps(fill),
    );
    return fills.map((fill): MarkupPiece => {
      // A forwarded slot yields to the component's own block, with its props.
      if (fill.forward !== undefined) {
        const to = fill.forward === "default" ? "" : ` to="${fill.forward}"`;
        const props = this.#forwardsProps(fill) ? this.rowName(`${fill.slot}Props`) : undefined;
        const outlet: MarkupPiece = {
          kind: "code",
          code: `{{yield${props === undefined ? "" : ` ${props}`}${to}}}`,
        };
        if (!named) return outlet;
        return {
          kind: "block",
          segments: [
            {
              open: `<:${fill.slot}${props === undefined ? "" : ` as |${props}|`}>`,
              content: outlet,
            },
          ],
          close: `</:${fill.slot}>`,
        };
      }
      const content: MarkupPiece = { kind: "nodes", nodes: fill.children, container: fill };
      if (!named) return content;
      const params = fill.parameter ? ` as |${this.#scope(fill, node)}|` : "";
      return {
        kind: "block",
        segments: [{ open: `<:${fill.slot}${params}>`, content }],
        close: `</:${fill.slot}>`,
      };
    });
  }

  /** Whether a fill forwards a slot of the component's own that takes props. */
  #forwardsProps(fill: SlotFill): boolean {
    if (fill.forward === undefined) return false;
    const slot = this.#component.slots?.slots.find((each) => each.name === fill.forward);
    return slot?.props !== undefined;
  }

  /**
   * A child with the fills it takes. Glimmer passes a named block whether or not the component
   * got the one it forwards, and the child's `(has-block)` would hold. So a child that forwards
   * slots renders in a branch for each set of them the component got, with only those.
   */
  forwarding(node: ComponentNode): MarkupPiece[] {
    const forwarded = node.fills.filter((fill) => fill.forward !== undefined);
    const branch = (index: number, absent: ReadonlySet<SlotFill>): MarkupPiece => {
      const fill = forwarded[index];
      if (!fill) {
        const fills = node.fills.filter((each) => !absent.has(each));
        return { kind: "component", component: { ...node, fills }, directives: [] };
      }
      const test = fill.forward === "default" ? "(has-block)" : `(has-block "${fill.forward}")`;
      return {
        kind: "block",
        segments: [
          { open: `{{#if ${test}}}`, content: branch(index + 1, absent) },
          { open: "{{else}}", content: branch(index + 1, new Set(absent).add(fill)) },
        ],
        close: "{{/if}}",
      };
    };
    return [branch(0, new Set())];
  }

  /**
   * Declares a scoped fill's names: its block param holds the props object, which a getter takes
   * as a row variable, typed by the child's `Blocks`.
   */
  #scope(fill: SlotFill, node: ComponentNode): string {
    const parameter = fill.parameter!;
    const child = this.#children.get(node.component);
    if (!child) throw new Error(`No output imports \`${node.component}\`.`);
    this.#signatures.set(child.local, child);
    const param = this.#local(parameter.name ?? `${fill.slot}Props`);
    this.#rows.set(param, `${this.#childType(child, "Signature")}["Blocks"]["${fill.slot}"][0]`);
    this.#rowLists.set(param, fill);
    const { start, end } = parameter.span;
    const keys = parameter.pattern
      ? patternKeys(parameter.pattern.code)
      : new Map<string, string>();
    for (const binding of this.#component.bindings) {
      if (binding.kind !== "slotScope") continue;
      const offset = Number(binding.id.slice(binding.id.lastIndexOf("@") + 1));
      if (offset < start || offset > end) continue;
      const key = keys.get(binding.name) ?? binding.name;
      const member = /^[A-Za-z_$][\w$]*$/.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`;
      this.#slotScope.set(binding.id, parameter.pattern ? `${param}${member}` : param);
    }
    return param;
  }

  /**
   * A slot outlet (ADR-0054): `{{yield}}`, a named slot's `{{yield to="header"}}`, with a scoped
   * slot's props object as its value, and the fallback where the parent left it empty.
   */
  slotOutlet(node: SlotOutletNode, props: string | undefined): MarkupPiece[] {
    const value = props === undefined ? "" : ` ${this.value(props, true, node)}`;
    const to = node.slot === "default" ? "" : ` to="${node.slot}"`;
    const outlet: MarkupPiece = { kind: "code", code: `{{yield${value}${to}}}` };
    if (!node.fallback.length) return [outlet];
    return [
      {
        kind: "block",
        segments: [
          {
            open:
              node.slot === "default"
                ? "{{#if (has-block)}}"
                : `{{#if (has-block "${node.slot}")}}`,
            content: outlet,
          },
          { open: "{{else}}", content: { kind: "nodes", nodes: node.fallback, container: node } },
        ],
        close: "{{/if}}",
      },
    ];
  }

  /**
   * The handler of a child's event (ADR-0053): the setup function it names, or a member that
   * holds the inline one, its parameters typed by the child's events (`FieldEvents`).
   */
  componentListener(attribute: ListenerAttribute, node: ComponentNode): string {
    const { handler } = attribute;
    if (handler.kind === "Function") return `this.${bindingName(this.#component, handler.binding)}`;
    const child = this.#children.get(node.component);
    if (!child) throw new Error(`No output imports \`${node.component}\`.`);
    const events = this.#childType(child, "Events");
    this.#eventTypes.set(child.local, {
      specifier: child.specifier,
      name: `${child.name}Events`,
      self: child.self,
    });
    return this.#inline(
      handler.function,
      node,
      `NonNullable<${events}["${eventArgument(attribute.event)}"]>`,
    );
  }

  /**
   * A member that holds an inline handler, called with the row variables it reads. `type`
   * types its parameters, through \`satisfies\`, where the source leaves them to the context.
   */
  #inline(fn: FunctionCode, at: object, type?: string): string {
    let code = functionText(fn, this.#component, this.rules, "client");
    // The branches around the listener narrow what it reads in the source, which a field does
    // not: it tests them again, as they hold whenever its element is rendered.
    const conditions = this.#conditions(code, at);
    if (conditions.length) {
      const body = functionBodyText(fn, this.#component, this.rules, "client");
      const test = conditions.map((each) => `(${each})`).join(" && ");
      code = `${fn.async ? "async " : ""}(${parametersText(fn)}) => {\n  if (!(${test})) return;\n${indent(body)}\n}`;
    }
    if (type !== undefined) code = `(${code}) satisfies ${type}`;
    const own = new Set(fn.parameters.flatMap((each) => each.name ?? each.pattern?.names ?? []));
    const { name, parameters } = this.#hoist(code, "listener", at, own);
    if (!parameters.length) return `this.${name}`;
    return `(this.${name} ${parameters.map((each) => each.name).join(" ")})`;
  }

  /**
   * Declares a list's row variables for its body, typed from its source: the item is an
   * element of the source's array, the index a number.
   */
  row(source: string, item: string, index: string | undefined, at: object): string {
    const value = this.value(source, true, at);
    const type = this.#typeOf(source, value);
    this.#rows.set(item, `NonNullable<${type}>[number]`);
    this.#rowLists.set(item, at);
    if (index !== undefined) {
      this.#rows.set(index, "number");
      this.#rowLists.set(index, at);
    }
    return value;
  }

  /** The type of the value the class reads at a Glimmer expression for `code`. */
  #typeOf(code: string, value: string): string {
    const path = this.#path(code);
    if (path !== undefined) return pathType(code, this.#rows);
    const name = /^\(?this\.(value\d+)/.exec(value)?.[1];
    if (name === undefined) throw new Error(`No member holds \`${code}\`.`);
    return value.includes(" ") ? `ReturnType<this["${name}"]>` : `this["${name}"]`;
  }

  /** The code of a class built from parts: one `classNames` call, which skips empty tokens. */
  classCode(parts: readonly ClassPart[]): string {
    this.#helpers.add("classNames");
    return `classNames(${classItems(parts).join(", ")})`;
  }

  /** The code of a style built from parts: one `styleText` call over its declarations. */
  styleCode(parts: readonly StylePart[]): string {
    this.#helpers.add("styleText");
    this.#usesHtmlSafe = true;
    const entries = parts.map((part) => {
      if (part.kind === "Static")
        return `[${JSON.stringify(part.property)}, ${JSON.stringify(part.value)}]`;
      return `[${JSON.stringify(part.property)}, ${part.value}]`;
    });
    return `styleText([${entries.join(", ")}])`;
  }

  /**
   * A root's `style` with the caller's `@style` merged in, where the element or child is the
   * fallthrough root. `null` for a child that takes no fallthrough, and `undefined` for any other.
   */
  fallthroughStyle(parts: readonly StylePart[], element: ElementNode): string | null | undefined {
    const child = this.isChild(element);
    if (child && !takesFallthrough(this.#module, element.tag)) return null;
    if (!this.#fallthroughAt(element)) return undefined;
    this.#helpers.add("fallthroughStyle");
    this.#usesHtmlSafe = true;
    const text = parts.every((part) => part.kind === "Static")
      ? staticStyleValue(parts)
      : undefined;
    const literal = text === undefined ? undefined : styleLiteral(text);
    const own =
      literal ??
      (text === undefined
        ? this.styleArgument(parts, element, true)
        : this.value(JSON.stringify(text), true, element));
    return `${child ? "@style" : "style"}={{fallthroughStyle ${own} @style}}`;
  }

  /**
   * A child's `@style` as its declarations, `[property, value]`, so that a nullish value removes
   * the root's own, as Vue's merge does (`fallthroughStyle`).
   */
  styleArgument(parts: readonly StylePart[], element: ElementNode, subexpression = false): string {
    const entries = parts.map((part) => {
      const value = part.kind === "Static" ? JSON.stringify(part.value) : part.value;
      return `[${JSON.stringify(part.property)}, ${value}] as const`;
    });
    return this.value(`[${entries.join(", ")}]`, subexpression, element);
  }

  /**
   * `<Teleport to>` (ADR-0098): Glimmer's `{{#in-element}}` appends the content to `to`'s
   * element, which `teleportTarget` finds in the browser only, so the server renders none of it.
   */
  teleport(node: TeleportNode): MarkupPiece[] {
    this.#helpers.add("teleportTarget");
    const target = this.rowName("target");
    return [
      {
        kind: "block",
        segments: [
          {
            open: `{{#let (teleportTarget ${JSON.stringify(node.to)}) as |${target}|}}{{#if ${target}}}{{#in-element ${target} insertBefore=null}}`,
            content: { kind: "nodes", nodes: node.children, container: node },
          },
        ],
        close: "{{/in-element}}{{/if}}{{/let}}",
      },
    ];
  }

  /**
   * `<Transition>` (ADR-0100): a transition for the block, whose entries are the elements it
   * renders, each branch's element where its entry's branch is that branch (`transition.ts`).
   */
  transition(node: TransitionNode, branch: string): MarkupPiece[] {
    this.#helpers.add("transition");
    const [child] = node.children;
    const source = this.#listener(`(): number => ${branch}`, node);
    // Not `transition`, which would hide the helper from a transition inside this one.
    const t = this.rowName("transitionList");
    const entry = this.rowName("entry");
    this.#transitionEntries.set(node, entry);
    const shown =
      child?.kind === "If"
        ? child.branches.flatMap((each, index) => (each.children.length ? [{ each, index }] : []))
        : [];
    const content: MarkupPiece =
      child?.kind === "If"
        ? {
            kind: "block",
            segments: shown.map(({ each, index }, at) => ({
              open: `{{${at === 0 ? "#if" : "else if"} (eq ${entry}.branch ${index})}}`,
              content: { kind: "nodes", nodes: each.children, container: each },
            })),
            close: "{{/if}}",
          }
        : { kind: "nodes", nodes: node.children, container: node };
    return [
      {
        kind: "block",
        segments: [
          {
            open: `{{#let (transition ${source} ${JSON.stringify(node.name)} ${node.appear ? "true" : "false"}) as |${t}|}}{{#each ${t}.entries key="id" as |${entry}|}}{{#unless ${entry}.gone}}`,
            content,
          },
        ],
        close: "{{/unless}}{{/each}}{{/let}}",
      },
    ];
  }

  /** The modifier that runs a transition's classes on its element, with its entry. */
  transitionClasses(node: TransitionNode): string {
    const entry = this.#transitionEntries.get(node);
    if (entry === undefined) throw new Error("A transition's element printed before it.");
    return `{{transitionClasses ${entry}}}`;
  }

  /** Whether the printer writes a child's tag, not an element. */
  isChild(element: ElementNode): boolean {
    return this.#children.has(element.tag);
  }

  /** Whether a child's tag takes a `class`: only one that takes fallthrough does. */
  takesClass(element: ElementNode): boolean {
    return !this.isChild(element) || takesFallthrough(this.#module, element.tag);
  }

  /** The root node at an element, or a child's tag, the printer writes. */
  #rootAt(element: ElementNode): RootNode | undefined {
    const { start, end } = element.span;
    return this.#roots.find(({ span }) => span.start === start && span.end === end);
  }

  /** The fallthrough root at an element, or a child's tag, the printer writes. */
  #fallthroughAt(element: ElementNode): RootNode | undefined {
    const root = this.#fallthrough;
    if (!root || root.span.start !== element.span.start || root.span.end !== element.span.end) {
      return undefined;
    }
    return root;
  }

  rowName(name: string): string {
    return this.#local(name);
  }

  enumerated(): string {
    this.#helpers.add("enumeratedValue");
    return "enumeratedValue";
  }

  parentOf(node: object): object | undefined {
    return this.#parents.get(node);
  }

  /** Raw markup: the string as `htmlSafe` marks it. */
  rawHtml(code: string): string {
    this.#usesHtmlSafe = true;
    return `{{htmlSafe ${this.value(code, true)}}}`;
  }

  /**
   * A composable's module (ADR-0069): its setup as a class on the inline `Composable`, whose
   * fields read the arguments its constructor took first, and the exported function, which
   * takes the calling component first, as its hooks run with the component's.
   */
  printComposable(): string {
    const composable = this.#composable!;
    this.#helpers.add("Composable");
    const members = this.#setupMembers();
    const { text: imports, reads } = this.#imports(members);
    const parts = imports ? [imports] : [];
    for (const type of this.#types(reads.types)) parts.push(type);
    if (reads.constants.length) parts.push(reads.constants.join("\n"));
    const typeParameters = this.#typeParameters();
    const typeArguments = this.#typeArguments();
    const className = `${composable.name.charAt(0).toUpperCase()}${composable.name.slice(1)}`;
    const argsType = `${className}Args`;
    const fields = composable.parameters.map((each) => `  ${each.name}: ${each.type.code};`);
    parts.push(`interface ${argsType}${typeParameters} {\n${fields.join("\n")}\n}`);
    // Before the class, which extends it as the module runs.
    parts.push(HELPERS.Composable);
    const body = members.map(indent);
    // A composable that runs code in the browser gives its caller what to call where the call
    // sits among the caller's own: what the template calls before and after its content, and
    // the hooks once it has rendered.
    if (this.#composableEffects()) {
      const calls = (list: readonly string[]) =>
        list.map((each) => `  ${each.replace(/^\{\{\((.*)\)\}\}$/, "$1")}();`).join("\n");
      const hooks = this.#composableHooks.map((each) => indent(each)).join("\n");
      body.push(
        indent(
          `readonly flush = (): undefined => {\n${calls(this.#before)}${this.#before.length ? "\n" : ""}  return undefined;\n};`,
        ),
        indent(
          `readonly flushAfter = (): undefined => {\n${calls(this.#after)}${this.#after.length ? "\n" : ""}  return undefined;\n};`,
        ),
        indent(`readonly mount = (): void => {${hooks ? `\n${hooks}\n` : ""}};`),
      );
    }
    parts.push(
      `class ${className}${typeParameters} extends Composable<${argsType}${typeArguments}> {\n${body.join("\n\n")}\n}`,
    );
    const parameters = composable.parameters.map((each) => `${each.name}: ${each.type.code}`);
    const names = composable.parameters.map((each) => each.name);
    parts.push(
      `export function ${composable.name}${typeParameters}(${["owner: object"].concat(parameters).join(", ")}): ${className}${typeArguments} {\n  return new ${className}${typeArguments}(owner, { ${names.join(", ")} });\n}`,
    );
    for (const name of Array.from(this.#helpers).toSorted()) {
      if (HELPERS[name] && name !== "Composable") parts.push(HELPERS[name]);
    }
    return `${parts.join("\n\n")}\n`;
  }

  /** The module's text. */
  print(): string {
    const component = this.#component;
    const root = component.render.kind === "Element" ? component.render : undefined;
    const markup = printMarkup(component.render, emberDialect(this), {
      level: 2,
      component,
      module: this.#module,
      rewrite: this.rules,
      // Attributes the caller passes land on the root (`...attributes`), or on each node a root
      // conditional or `<component is>` may render, and its `@style` with them.
      scopeRootAttributes: (element) => {
        if (component.inheritAttrs === false || !this.#rootAt(element)) return [];
        const style = this.#fallthroughAt(element);
        if (!style || hasOwnStyle(style)) return ["...attributes"];
        if (style.component) return ["@style={{@style}}", "...attributes"];
        this.#helpers.add("fallthroughStyle");
        this.#usesHtmlSafe = true;
        return ["style={{fallthroughStyle @style}}", "...attributes"];
      },
      // The provider's marker comes first in the root, so the root's descendants find it, and
      // no sibling of the root does (`provider`).
      childrenWrapper: (element) =>
        element === root && this.#provides
          ? { open: "{{this.providerMarker}}", close: "" }
          : undefined,
    });
    const members = this.#propGetters().concat(this.#setupMembers(), this.#hoistedMembers);
    const own = ownDirectives(component, this.#module);
    if (own.length) this.#helpers.add("directive");
    const { text: imports, reads } = this.#imports(members);
    const parts = [imports];
    for (const type of this.#types(reads.types)) parts.push(type);
    // The module's values it reads, as the source declares them (ADR-0070).
    if (reads.constants.length) parts.push(reads.constants.join("\n"));
    // The module's own directives it applies, each a modifier (ADR-0099).
    for (const directive of own) parts.push(directiveDeclaration(directive));
    parts.push(this.#signature());
    // A consumer's marker comes first, outside what the component provides itself (`inject`).
    const marker = this.#injects ? "{{this.injectionMarker}}" : "";
    // An async setup renders nothing until it has run, as Vue's `<Suspense>` shows none of it.
    const content = `${this.#before.join("")}${markup.trimStart()}${this.#after.join("")}`;
    const body = this.#helpers.has("AsyncSetup")
      ? `{{#if this.asyncSetup.resolved}}${content}{{/if}}`
      : content;
    const template = `<template>${marker}${body}</template>`;
    parts.push(this.#declaration(members, template));
    for (const name of Array.from(this.#helpers).toSorted()) {
      if (HELPERS[name]) parts.push(HELPERS[name]);
    }
    return `${parts.join("\n\n")}\n`;
  }

  /**
   * What `provide` gives or `inject` falls back to under a key: for a key that holds a ref, a
   * state as its ref, `{ value }` read from the tracked field as the state changes (`refOf`).
   */
  #contextValue(key: string, code: Code): string {
    const value = rewrite(code, this.#component, this.rules, "pure");
    const [ref] = code.refs;
    const whole =
      code.refs.length === 1 &&
      ref?.kind === "Binding" &&
      ref.span.start === code.span.start &&
      ref.span.end === code.span.end;
    if (!this.#key(key).ref || !whole) return value;
    this.#helpers.add("refOf");
    return `refOf(() => ${value})`;
  }

  /**
   * A key the setup names: its value's type in the class's terms, a ref's as `{ value }`, with
   * the module its type's names are imported from, for a key of another module.
   */
  #key(local: string): { type: string; ref: boolean; specifier?: string; names: string[] } {
    const module = this.#module;
    const own = module.keys?.find((key) => key.name === local);
    if (own)
      return { type: keyValueType(own.type.code, own.ref), ref: own.ref !== undefined, names: [] };
    const imported = keyImports(this.#component, module, (name) => `${name}.gts`).find(
      (key) => key.local === local,
    );
    for (const entry of module.imports ?? []) {
      const name = entry.names.find((each) => each.kind === "Key" && each.local === local);
      const api = name && entry.api.keys?.find((key) => key.name === name.imported);
      if (!api) continue;
      return {
        type: keyValueType(api.type, api.ref),
        ref: api.ref !== undefined,
        ...(imported?.specifier ? { specifier: imported.specifier } : {}),
        // A ref's type is the source's (`Ref<number>`), which the output writes as `{ value }`.
        names: (api.references ?? []).filter((each) => !api.ref || each !== api.ref),
      };
    }
    throw new Error(`No module declares the key \`${local}\`.`);
  }

  /** The imports: Glimmer's and Ember's, then the types and the pass-through modules. */
  #imports(members: readonly string[]): { text: string; reads: ModuleReads } {
    const isClass = members.length > 0 || this.#component.typeParameters !== undefined;
    const component = this.#component;
    const module = this.#module;
    const lines = this.#composable
      ? []
      : [
          isClass
            ? 'import Component from "@glimmer/component";'
            : 'import type { TOC } from "@ember/component/template-only";',
        ];
    const tracking = [];
    if (this.#injects || this.#provides) tracking.push("cached");
    if (
      component.setup.some(
        (item) =>
          item.kind === "State" ||
          item.kind === "TemplateRef" ||
          (item.kind === "Model" && !item.required),
      ) ||
      this.#helpers.has("transition") ||
      this.#helpers.has("AsyncSetup") ||
      this.#helpers.has("Effect")
    ) {
      tracking.push("tracked");
    }
    if (tracking.length) {
      lines.push(`import { ${tracking.join(", ")} } from "@glimmer/tracking";`);
    }
    if (this.#helpers.has("fallthroughStyle")) {
      lines.push('import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";');
    } else if (this.#usesHtmlSafe) lines.push('import { htmlSafe } from "@ember/template";');
    const ember = new Map<string, Set<string>>();
    for (const helper of this.#helpers) {
      for (const [specifier, names] of Object.entries(HELPER_IMPORTS[helper])) {
        const set = ember.get(specifier) ?? new Set<string>();
        for (const name of names) set.add(name);
        ember.set(specifier, set);
      }
    }
    for (const specifier of Array.from(ember.keys()).toSorted()) {
      const names = Array.from(ember.get(specifier)!).toSorted();
      const types = names.filter((name) => name.startsWith("type "));
      if (types.length === names.length) {
        lines.push(
          `import type { ${types.map((name) => name.slice(5)).join(", ")} } from "${specifier}";`,
        );
      } else lines.push(`import { ${names.join(", ")} } from "${specifier}";`);
    }
    const imports = new ImportSet(module.components.map((each) => each.name));
    addTypeImports(component, module, imports, (name) => `${name}.gts`);
    const reads = moduleReads(component, module, imports);
    // Each child's output, a sibling `.gts` file, under the source's name (ADR-0053).
    for (const child of this.#children.values()) {
      if (child.self) continue;
      if (child.export === "default")
        imports.addDefault(child.specifier, child.local, { exact: true });
      else imports.add(child.specifier, child.name, { local: child.local, exact: true });
    }
    // Each composable of a `.uf.ts` module, from its own module beside it, `useToggle.ts`.
    for (const entry of module.imports ?? []) {
      for (const name of entry.names) {
        if (name.kind !== "Composable") continue;
        if (!component.setup.some((item) => item.kind === "Use" && item.composable === name.local))
          continue;
        imports.add(directiveSpecifier(entry.specifier, `${name.imported}.ts`), name.imported, {
          local: name.local,
          exact: true,
        });
      }
    }
    // Each directive of a `.uf.ts` module, from its own module beside it, `vFocusTrap.ts`.
    for (const { specifier, imported, local } of importedDirectives(component, module)) {
      imports.add(directiveSpecifier(specifier, `${imported}.ts`), imported, {
        local,
        exact: true,
      });
    }
    // The keys of other modules, from their main component's output (ADR-0054).
    for (const key of keyImports(component, module, (name) => `${name}.gts`)) {
      if (!key.specifier) continue;
      imports.add(key.specifier, key.name, { local: key.local, exact: true });
      // The names an injected value's type reads, which its getter is typed by.
      const injected = component.setup.some(
        (item) => item.kind === "Inject" && item.key === key.local,
      );
      if (!injected) continue;
      for (const name of this.#key(key.local).names) {
        imports.add(key.specifier, name, { type: true, exact: true });
      }
    }
    for (const { specifier, name, self } of this.#eventTypes.values()) {
      if (!self) imports.add(specifier, name, { type: true, exact: true });
    }
    // A child's signature, where a member's row variable is typed by its `Blocks`, or the
    // signature's `Element` by a root child's.
    const read = members.join("\n");
    for (const child of this.#signatures.values()) {
      if (!child.self && new RegExp(`\\b${child.name}Signature[[<]`).test(read)) {
        imports.add(child.specifier, `${child.name}Signature`, { type: true, exact: true });
      }
    }
    for (const root of this.#roots) {
      const child = root.component === undefined ? undefined : this.#children.get(root.component);
      if (child && !child.self) {
        imports.add(child.specifier, `${child.name}Signature`, { type: true, exact: true });
      }
    }
    for (const { specifier, names } of passThroughImports(component, module)) {
      if (!names.length) imports.addPassThrough(specifier);
      for (const { imported, local } of names) {
        imports.addPassThrough(specifier, { imported, local: this.#local(local) });
      }
    }
    const declarations = imports.toDeclarations();
    // The sheet `compile()` writes beside the source, already scoped (ADR-0063): the markup
    // printer gives each element the sheet's `data-uf-…` attribute.
    if (component.styles) {
      const file = module.file;
      declarations.push(js.importDeclaration(`./${file.slice(file.lastIndexOf("/") + 1)}.css`, []));
    }
    if (declarations.length) lines.push(printProgram(js.program(declarations)).trim());
    return { text: lines.join("\n"), reads };
  }

  /** The type declarations the component reaches, and its module's type exports, in order. */
  #types(reached: readonly TypeDeclaration[]): string[] {
    const component = this.#component;
    const module = this.#module;
    const types = typeExportsCode(component, module, (name) => `${name}.gts`);
    for (const declaration of componentTypes(component, module).concat(reached)) {
      types.push({ code: typeDeclarationCode(declaration), span: declaration.span });
    }
    if (keyOwner(module.components, module.exports) === component.name) {
      for (const key of module.keys ?? [])
        types.push({ code: keyDeclaration(key), span: key.span });
    }
    return types.toSorted((a, b) => a.span.start - b.span.start).map(({ code }) => code);
  }

  /**
   * `CardSignature`: the props and the events' arguments as `Args`, and the root element as
   * `Element`. The events are an interface of their own, `CardEvents`, each an optional argument
   * named by {@link eventArgument} that takes the event's payload.
   */
  #signature(): string {
    const component = this.#component;
    const { emits } = component;
    const args: string[] = [];
    if (component.propsParameter) args.push(component.propsParameter.type.code);
    // The parent's ref, which takes what the component exposes (`componentRef`).
    if (component.exposes) {
      const names = this.#exposedNames().map((name) => JSON.stringify(name));
      args.push(
        `{ ref?: (exposed: Pick<${component.name}, ${names.join(" | ")}> | null) => void }`,
      );
    }
    // A caller's `style`, which the root merges into its own (`fallthroughStyle`).
    if (this.#fallthrough) args.push("{ style?: unknown }");
    let events = "";
    if (emits) {
      const name = `${component.name}Events${this.#typeArguments()}`;
      const members = emits.events.map((event) => {
        const parameters = event.parameters
          .map((each) => `${each.name}${each.optional ? "?" : ""}: ${each.type.code}`)
          .join(", ");
        return `  ${eventArgument(event.name)}?: (${parameters}) => void;`;
      });
      events = `export interface ${component.name}Events${this.#typeParameters()} {\n${members.join("\n")}\n}\n\n`;
      args.push(name);
    }
    // Each model's value and the callback that hears its writes, an interface of their own.
    const models = component.setup.flatMap((item) => (item.kind === "Model" ? [item] : []));
    if (models.length) {
      const name = `${component.name}Models${this.#typeArguments()}`;
      const members = models.flatMap((item) => {
        const type = item.type?.code ?? "unknown";
        return [
          `  ${item.name}${item.required ? "" : "?"}: ${type};`,
          `  ${modelArgument(item.name)}?: (value: ${type}) => void;`,
        ];
      });
      events += `export interface ${component.name}Models${this.#typeParameters()} {\n${members.join("\n")}\n}\n\n`;
      args.push(name);
    }
    const lines: string[] = [];
    if (args.length) lines.push(`  Args: ${args.join(" & ")};`);
    // Each slot a block, which yields a scoped slot's props object.
    if (component.slots) {
      const blocks = component.slots.slots.map(
        (slot) => `    ${slot.name}: [${slot.props ? `props: ${slot.props.code}` : ""}];`,
      );
      lines.push(`  Blocks: {\n${blocks.join("\n")}\n  };`);
    }
    // A root child's own `Element`, which its `...attributes` reach.
    const elements = new Set<string>();
    for (const root of this.#roots) {
      for (const tag of root.tags) elements.add(elementType(tag));
      const child = root.component === undefined ? undefined : this.#children.get(root.component);
      if (child && !child.self) elements.add(`${this.#childType(child, "Signature")}["Element"]`);
    }
    // A root that is no one element, such as a fragment or a teleport, takes no attributes. The
    // signature still names one, so a styled parent can pass its scope attributes, which
    // Glimmer drops without `...attributes`, as Vue's fallthrough reaches none.
    lines.push(`  Element: ${elements.size ? Array.from(elements).join(" | ") : "Element"};`);
    return `${events}export interface ${component.name}Signature${this.#typeParameters()} {\n${lines.join("\n")}\n}`;
  }

  /**
   * The component with the source's export shape: a lone default or same-name export in place,
   * any other through an export list. A class when it has members, a `TOC` constant otherwise.
   */
  #declaration(members: readonly string[], template: string): string {
    const { name } = this.#component;
    const signature = `${name}Signature`;
    const exports = exportsOf(name, this.#module.exports);
    const only = exports.length === 1 ? exports[0]! : undefined;
    const isDefault = only?.kind === "default";
    const inPlace = isDefault || only?.name === name;
    const list = inPlace
      ? ""
      : `\n\nexport { ${exports
          .map((entry) => `${name} as ${entry.kind === "default" ? "default" : entry.name}`)
          .join(", ")} };`;
    // A generic component is a class even without members: Glint types a template-only one
    // with no type parameters.
    if (members.length || this.#component.typeParameters) {
      const keyword = isDefault ? "export default " : inPlace ? "export " : "";
      const body = members.map(indent).join("\n\n");
      const head = `${keyword}class ${name}${this.#typeParameters()} extends Component<${signature}${this.#typeArguments()}>`;
      return `${head} {\n${body ? `${body}\n\n` : ""}  ${template}\n}${list}`;
    }
    const constant = `const ${name}: TOC<${signature}> = ${template.replace(/\n {2}/g, "\n")};`;
    if (isDefault) return `${constant}\n\nexport default ${name};`;
    return `${inPlace ? "export " : ""}${constant}${list}`;
  }

  /** A generic component's type parameters as declared, `<T extends string>`, or nothing. */
  #typeParameters(): string {
    const parameters = this.#component.typeParameters;
    if (!parameters) return "";
    const each = parameters.map(
      (parameter) =>
        `${parameter.name}${parameter.constraint ? ` extends ${parameter.constraint.code}` : ""}${parameter.default ? ` = ${parameter.default.code}` : ""}`,
    );
    return `<${each.join(", ")}>`;
  }

  /** A generic component's type parameters as arguments, `<T>`, or nothing. */
  #typeArguments(): string {
    const parameters = this.#component.typeParameters;
    return parameters ? `<${parameters.map((parameter) => parameter.name).join(", ")}>` : "";
  }

  /**
   * A child's signature or events interface by name, with `never` for each type parameter of a
   * generic child, which satisfies any constraint: the parent's members read only its shape.
   */
  #childType(child: ChildImport, suffix: "Signature" | "Events"): string {
    const count = this.#childTypeParameters(child.local);
    return `${child.name}${suffix}${count ? `<${Array.from({ length: count }, () => "never").join(", ")}>` : ""}`;
  }

  /** How many type parameters a child takes, by the name the template writes. */
  #childTypeParameters(local: string): number {
    for (const entry of this.#module.imports ?? []) {
      const imported = entry.names.find(
        (name) => name.kind === "Component" && name.local === local,
      );
      if (!imported) continue;
      const api = entry.api.components.find((each) =>
        imported.imported === "default"
          ? each.export === "default"
          : each.export === "named" && each.name === imported.imported,
      );
      return api?.typeParameters?.length ?? 0;
    }
    const own = this.#module.components.find((each) => each.name === local);
    return own?.typeParameters?.length ?? 0;
  }

  /** A getter for each prop with a default: an absent or `undefined` argument takes it. */
  #propGetters(): string[] {
    return this.#component.props
      .filter((prop) => prop.default)
      .map(
        (prop) =>
          `get ${prop.name}() {\n  return this.args.${prop.name} === undefined ? ${prop.default!.code} : this.args.${prop.name};\n}`,
      );
  }

  /** A model's value type: its type argument, `undefined` too without a default. */
  #modelType(item: Extract<UfComponent["setup"][number], { kind: "Model" }>): string {
    const type = item.type?.code ?? "unknown";
    return item.default || item.required ? type : `${type} | undefined`;
  }

  /**
   * Whether a composable runs code in the browser, as the analyser's `hasEffects` sets it: a
   * watcher, an effect, a hook, or a call of a composable that does.
   */
  #composableEffects(): boolean {
    return this.#component.setup.some(
      (item) =>
        item.kind === "Watch" ||
        item.kind === "WatchEffect" ||
        item.kind === "Lifecycle" ||
        (item.kind === "Use" && item.hasEffects === true),
    );
  }

  /** A member name no binding of the component takes. */
  #unique(name: string): string {
    const taken = new Set(this.#component.bindings.map((each) => each.name));
    let unique = name;
    while (taken.has(unique)) unique = `${unique}_`;
    return unique;
  }

  /** The tracked field that holds a model's value while the parent passes none. */
  #modelLocal(name: string): string {
    const taken = new Set(this.#component.bindings.map((each) => each.name));
    let local = `${name}Local`;
    while (taken.has(local)) local = `${local}_`;
    return local;
  }

  /** The names of the functions `defineExpose` exposes, as the class's members. */
  #exposedNames(): string[] {
    const { exposes, bindings } = this.#component;
    return (exposes?.functions ?? []).map((id) => {
      const binding = bindings.find((each) => each.id === id);
      if (!binding) throw new Error(`No binding \`${id}\` is exposed.`);
      return this.#local(binding.name);
    });
  }

  /** The setup's declarations as members, in source order, then the lifecycle hooks. */
  #setupMembers(): string[] {
    const component = this.#component;
    const rules = this.rules;
    const hooks: string[] = [];
    /** What the setup provides, as `[key, value]` entries. */
    const provided: string[] = [];
    // The functions come first: a field's value may call one the source declares after it, as
    // the source's function declarations are hoisted.
    const functions: string[] = [];
    let watchers = 0;
    let effects = 0;
    // An async setup's statements from its first `await` on, which `AsyncSetup` runs: each
    // awaited value, and each value declared after one, which may read it.
    const run: string[] = [];
    /** A field whose value the run sets: its type, and the arrow that gives its first value. */
    const deferred = (name: string, type: string | undefined, value: string, awaits = false) => {
      const initial = this.#unique(`initial${name.charAt(0).toUpperCase()}${name.slice(1)}`);
      const read = `this.${initial}()`;
      run.push(`this.${name} = ${awaits ? `await ${read}` : read};`);
      if (awaits) run.push("if (isDestroying(this)) return;");
      // `typeof this.…` reads the instance's own type, which a concrete value is assignable to,
      // where `this["…"]` is the polymorphic `this`.
      const inferred = awaits
        ? `Awaited<ReturnType<typeof this.${initial}>>`
        : `ReturnType<typeof this.${initial}>`;
      return { initial: `${initial} = () => ${value};`, type: type ?? inferred };
    };
    const members = component.setup.flatMap((item) => {
      const awaited = run.length > 0;
      switch (item.kind) {
        // A composable's call, whose result a field holds: the used bindings read its members.
        // Its first argument is the component, which its hooks run with.
        case "Use": {
          const field = this.#uses.get(item)!;
          const args = item.arguments.map((argument) => {
            if (argument.kind === "Value") return rewrite(argument.value, component, rules, "pure");
            const fn = argument.kind === "Getter" ? argument.getter : argument.callback;
            const site = argument.kind === "Getter" ? "pure" : "client";
            return functionText(fn, component, rules, site, { arrow: true });
          });
          const owner = this.#composable ? "this.owner" : "this";
          // Its watchers, effects and hooks run where the call sits among the caller's own.
          if (item.hasEffects) {
            this.#before.push(`{{(this.${field}.flush)}}`);
            this.#after.push(`{{(this.${field}.flushAfter)}}`);
            hooks.push(`this.${field}.mount();`);
          }
          return `readonly ${field} = ${this.#local(item.composable)}(${[owner].concat(args).join(", ")});`;
        }
        // The value an `await` gives, which the run sets before the rest of the setup reads it.
        case "Await": {
          this.#helpers.add("AsyncSetup");
          const name = bindingName(component, item.binding);
          const value = rewrite(item.value, component, rules, "client");
          const field = deferred(name, item.type?.code, value, true);
          return [field.initial, `${name}!: ${field.type};`];
        }
        // A template ref is tracked, as Vue's is reactive: `templateRef` sets it once its element
        // is rendered, and sets it to `null` once it is gone.
        case "TemplateRef": {
          const name = bindingName(component, item.binding);
          return `@tracked ${name}: ${item.type?.code ?? "Element"} | null = null;`;
        }
        // An id counted per application (`useId`), the same on the server and on the client that
        // hydrates its render.
        case "Id": {
          this.#helpers.add("useId");
          return `readonly ${bindingName(component, item.binding)} = useId(this);`;
        }
        case "Watch": {
          this.#helpers.add("Watcher");
          this.#helpers.add("callbacks");
          const name = `watcher${++watchers}`;
          this.#before.push(`{{(this.${name}.flush)}}`);
          const reads = item.sources.map((source) =>
            source.kind === "Ref"
              ? `this.${bindingName(component, source.binding)}`
              : functionText(source.getter, component, rules, "pure"),
          );
          let source: string;
          if (item.array) {
            this.#helpers.add("sources");
            const values = item.sources.map((each, index) =>
              each.kind === "Ref" ? reads[index]! : `(${reads[index]!})()`,
            );
            source = `() => sources(${values.join(", ")})`;
          } else {
            source = item.sources[0]!.kind === "Ref" ? `() => ${reads[0]!}` : reads[0]!;
          }
          const callback = functionText(item.callback, component, rules, "client");
          const options = [
            item.array ? "array: true" : "",
            item.immediate ? "immediate: true" : "",
            item.post ? "post: true" : "",
          ].filter(Boolean);
          const rest = options.length ? `, { ${options.join(", ")} }` : "";
          const owner = this.#composable ? "this.owner" : "this";
          return `readonly ${name} = new Watcher(${owner}, ${source}, ${callback}${rest});`;
        }
        case "WatchEffect": {
          this.#helpers.add("Effect");
          this.#helpers.add("callbacks");
          const name = `effect${++effects}`;
          this.#after.push(`{{(this.${name}.flush)}}`);
          const effect = functionText(item.effect, component, rules, "client");
          return `readonly ${name} = new Effect(${this.#composable ? "this.owner" : "this"}, ${effect});`;
        }
        // Each hook runs once the first render settles, unless the component is gone by then,
        // as a server render is; an `onUnmounted` hook is registered then, so it never runs on
        // the server either.
        case "Lifecycle": {
          this.#helpers.add("afterRender");
          const hook = functionText(item.callback, component, rules, "client");
          // A composable's hooks run with its caller's, as Vue registers them on the instance.
          const owner = this.#composable ? "this.owner" : "this";
          hooks.push(
            item.hook === "mounted"
              ? `afterRender(${owner}, ${hook});`
              : `afterRender(${owner}, () => registerDestructor(${owner}, ${hook}));`,
          );
          if (item.hook === "unmounted") this.#helpers.add("registerDestructor");
          return [];
        }
        // Each provided value is read once, as Vue's `provide` reads it, and a provided state is
        // its ref, `{ value }` over the tracked field (`provider`).
        case "Provide": {
          provided.push(`[${this.#local(item.key)}, ${this.#contextValue(item.key, item.value)}]`);
          return [];
        }
        // Read once, as Vue's `inject` reads it at setup: the template reads it after the
        // marker, which is in the DOM by then (`inject`).
        case "Inject": {
          this.#helpers.add("inject");
          const name = bindingName(component, item.binding);
          const key = this.#key(item.key);
          const fallback = item.fallback
            ? this.#contextValue(item.key, item.fallback)
            : "undefined";
          const type = item.fallback ? key.type : `${key.type} | undefined`;
          return `@cached\nget ${name}(): ${type} {\n  return inject(this.injectionMarker, ${this.#local(item.key)}, ${fallback});\n}`;
        }
        case "State": {
          const name = bindingName(component, item.binding);
          // A state without a value holds `undefined`, as `ref<T>()` does, typed `T | undefined`.
          // A write of the value it holds notifies nothing, as Vue's does: an effect would run.
          const type = item.type ? `: ${item.type.code}${item.initial ? "" : " | undefined"}` : "";
          const initial = item.initial
            ? rewrite(item.initial, component, rules, "pure")
            : "undefined";
          const decorator = this.#hasEffects ? "@tracked({ equals: Object.is })" : "@tracked";
          if (awaited && item.initial) {
            const field = deferred(name, item.type?.code, initial);
            return [field.initial, `${decorator} ${name}!: ${field.type};`];
          }
          return `${decorator} ${name}${type} = ${initial};`;
        }
        // Vue's `useModel`: the parent's argument where it passes one, and a tracked field of
        // the component's own where it does not. A write sets the field and calls the parent's
        // `@onUpdateValue`, as Vue's emits `update:value`.
        case "Model": {
          const name = bindingName(component, item.binding);
          const type = this.#modelType(item);
          const argument = modelArgument(item.name);
          // A required model always has the parent's argument, so it holds no value of its own.
          if (item.required) {
            return [
              `get ${name}(): ${type} {\n  return this.args.${item.name};\n}`,
              `set ${name}(value: ${type}) {\n  this.args.${argument}?.(value);\n}`,
            ];
          }
          const local = this.#modelLocal(name);
          const initial = item.default
            ? rewrite(item.default, component, rules, "pure")
            : "undefined";
          return [
            `@tracked ${local}: ${type} = ${initial};`,
            `get ${name}(): ${type} {\n  return this.args.${item.name} === undefined ? this.${local} : this.args.${item.name};\n}`,
            `set ${name}(value: ${type}) {\n  this.${local} = value;\n  this.args.${argument}?.(value);\n}`,
          ];
        }
        case "Derived": {
          const name = bindingName(component, item.binding);
          const body = functionBodyText(item.getter, component, rules, "pure");
          return `get ${name}()${item.type ? `: ${item.type.code}` : ""} {\n${indent(body)}\n}`;
        }
        case "Const": {
          const name = bindingName(component, item.binding);
          const type = item.type ? `: ${item.type.code}` : "";
          const value = rewrite(item.value, component, rules, "pure");
          if (awaited) {
            const field = deferred(name, item.type?.code, value);
            return [field.initial, `${name}!: ${field.type};`];
          }
          return `readonly ${name}${type} = ${value};`;
        }
        case "Variable": {
          const name = bindingName(component, item.binding);
          const type = item.type ? `: ${item.type.code}` : "";
          if (awaited && item.initial) {
            const value = rewrite(item.initial, component, rules, "client");
            const field = deferred(name, item.type?.code, value);
            return [field.initial, `${name}!: ${field.type};`];
          }
          const initial = item.initial
            ? ` = ${rewrite(item.initial, component, rules, "client")}`
            : "";
          return `${name}${type}${initial};`;
        }
        case "Function": {
          const name = bindingName(component, item.binding);
          const fn = typedEvent(item.function);
          functions.push(
            `${name} = ${functionText(fn, component, rules, "client", { arrow: true })};`,
          );
          return [];
        }
        // Composition and async setup: capabilities the cells leave unsupported, so the case
        // has no Ember output.
        default:
          return [];
      }
    });
    // Last, so that the fields it calls are set: the run starts as the instance is constructed.
    if (run.length) {
      members.push(
        `readonly asyncSetup = new AsyncSetup(this, async () => {\n${run.map((each) => `  ${each}`).join("\n")}\n});`,
      );
    }
    if (this.#injects) members.unshift('readonly injectionMarker = document.createTextNode("");');
    // Read when the template renders the marker, after the component's own `inject` can find
    // what it reads, as Vue's setup injects before it provides.
    if (provided.length) {
      this.#helpers.add("provider");
      members.push(
        `@cached\nget providerMarker(): Text {\n  return provider([${provided.join(", ")}]);\n}`,
      );
    }
    // What `defineExpose` exposes reaches the parent's ref once the component has rendered, and
    // `null` once it is gone, as Vue sets a component ref after its mount (`componentRef`).
    if (component.exposes) {
      this.#helpers.add("afterRender");
      this.#helpers.add("registerDestructor");
      const members = this.#exposedNames().map((name) => `${name}: this.${name}`);
      hooks.unshift(
        `afterRender(this, () => {\n  this.args.ref?.({ ${members.join(", ")} });\n  registerDestructor(this, () => this.args.ref?.(null));\n});`,
      );
    }
    if (hooks.length && this.#composable) {
      this.#composableHooks = hooks;
    } else if (hooks.length) {
      this.#after.push("{{(this.onMounted)}}");
      members.push(
        "#mounted = false;",
        `/** Called at the template's end: the hooks run once the component has rendered. */\nonMounted = (): undefined => {\n  if (!this.#mounted) {\n    this.#mounted = true;\n${hooks.map((each) => indent(indent(each))).join("\n")}\n  }\n  return undefined;\n};`,
      );
    }
    return functions.concat(members);
  }
}

/** An injection key (ADR-0054): the source's symbol, which `provider` and `inject` match. */
function keyDeclaration(key: InjectionKeyDeclaration): string {
  return `export const ${key.name} = Symbol(${JSON.stringify(key.description)});`;
}

/** A key's value type: a ref's (`Ref<number>`) as `{ readonly value: number }`. */
function keyValueType(type: string, ref: string | undefined): string {
  if (!ref) return type;
  const inner = /^\w+<([\s\S]*)>$/.exec(type.trim())?.[1];
  return `{ readonly value: ${inner ?? "unknown"} }`;
}

/**
 * A handler with its event parameter typed, which a class member cannot leave to the template
 * to infer: as `on` passes it (`HTMLElementEventMap["click"]`), or as the analyzer reads it.
 */
function typedEvent(fn: FunctionCode, type?: string): FunctionCode {
  if (!fn.parameters.some((each) => each.event !== undefined && each.type === undefined)) return fn;
  return {
    ...fn,
    parameters: fn.parameters.map((each) =>
      each.event !== undefined && each.type === undefined
        ? { ...each, type: { code: type ?? each.event, span: each.span } }
        : each,
    ),
  };
}

/**
 * The keywords of Ember's strict-mode templates that are identifiers: a name of the template's
 * scope takes another, so that the template, and the tools that read it, never confuse the two.
 */
const KEYWORDS: ReadonlySet<string> = new Set([
  "action",
  "and",
  "array",
  "component",
  "concat",
  "debugger",
  "each",
  "eq",
  "fn",
  "get",
  "gt",
  "gte",
  "hash",
  "helper",
  "if",
  "let",
  "log",
  "lt",
  "lte",
  "modifier",
  "mount",
  "mut",
  "neq",
  "not",
  "on",
  "or",
  "outlet",
  "unbound",
  "unless",
  "with",
  "yield",
]);

/** A checkbox's or a radio's own value: its `value` attribute, or `"on"`, as the DOM's. */
function ownValue(element: ElementNode, plan: ComponentPlan): string {
  for (const attribute of element.attributes) {
    if (attribute.kind === "Static" && attribute.name === "value") {
      return JSON.stringify(attribute.value === true ? "" : attribute.value);
    }
    if (attribute.kind === "Bound" && attribute.name === "value") {
      return `(${rewriteExpression(attribute.value, plan.component, plan.rules, "render")})`;
    }
  }
  return '"on"';
}

/** The marker of a slot's presence in code, which `value` writes as `(has-block "…")`. */
const HAS_BLOCK = "__ufHasBlock_";

/**
 * The key each name of a destructuring pattern reads: `{ item, index: position }` gives `item`
 * for `item` and `index` for `position`.
 */
function patternKeys(code: string): Map<string, string> {
  const keys = new Map<string, string>();
  const inner = code.trim().replace(/^\{|\}$/g, "");
  for (const entry of inner.split(",")) {
    const match =
      /^\s*(?:([A-Za-z_$][\w$]*)|"([^"]*)"|'([^']*)')\s*(?::\s*([A-Za-z_$][\w$]*))?/.exec(entry);
    if (!match) continue;
    const key = match[1] ?? match[2] ?? match[3]!;
    keys.set(match[4] ?? key, key);
  }
  return keys;
}

/** The argument a parent passes to listen to an event: `onChange` for `change`. */
/** The argument a parent passes to hear a model's writes: `onUpdateValue` for `value`. */
function modelArgument(model: string): string {
  return `onUpdate${model.charAt(0).toUpperCase()}${model.slice(1)}`;
}

function eventArgument(event: string): string {
  return `on${event.charAt(0).toUpperCase()}${event.slice(1)}`;
}

function bindingName(component: UfComponent, id: string): string {
  const binding = component.bindings.find((each) => each.id === id);
  if (!binding) throw new Error(`Component ${component.name} declares no binding ${id}.`);
  return binding.name;
}

/**
 * The type of a path's value in the class's terms: `this["args"]["user"]` for `@user`, through
 * `NonNullable` after each `?.`, from a row variable's own type.
 */
function pathType(code: string, rows: ReadonlyMap<string, string>): string {
  const [head, ...segments] = code.replace(/!/g, "").split(/(?=\??\.)/);
  let type = head === "this" ? "this" : rows.get(head!);
  if (type === undefined) throw new Error(`\`${head}\` is no row variable.`);
  for (const segment of segments) {
    const optional = segment.startsWith("?.");
    const name = segment.slice(optional ? 2 : 1);
    type = `${optional ? `NonNullable<${type}>` : type}["${name}"]`;
  }
  return type;
}

/** The element tags of a render tree. */
function tagsOf(root: object): Set<string> {
  const tags = new Set<string>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const each of value) visit(each);
      return;
    }
    if (value === null || typeof value !== "object") return;
    if ((value as { kind?: unknown }).kind === "Element") tags.add((value as { tag: string }).tag);
    for (const each of Object.values(value)) visit(each);
  };
  visit(root);
  return tags;
}

/** Every object of a render tree, by the object that holds it. */
function parentsOf(root: object): Map<object, object> {
  const parents = new Map<object, object>();
  const visit = (value: unknown, parent: object | undefined): void => {
    if (Array.isArray(value)) {
      for (const each of value) visit(each, parent);
      return;
    }
    if (value === null || typeof value !== "object") return;
    if (parent) parents.set(value, parent);
    for (const each of Object.values(value)) visit(each, value);
  };
  visit(root, undefined);
  return parents;
}

/** The class's paths code reads: `this.args.uptime`, `this.total`, a row variable. */
function readPaths(code: string): string[] {
  return code.match(/\bthis(?:\.args)?\.[A-Za-z_$][\w$]*|(?<![.\w$])[A-Za-z_$][\w$]*/g) ?? [];
}

/**
 * A class's parts as `classNames` arguments, in source order: static names as string literals,
 * dynamic values as written, and each toggle as a condition that yields its name.
 */
function classItems(parts: readonly ClassPart[]): string[] {
  const items: string[] = [];
  for (const part of parts) {
    if (part.kind === "Static") items.push(JSON.stringify(part.value));
    else if (part.kind === "Dynamic") items.push(part.value);
    else items.push(`(${part.condition}) && ${JSON.stringify(part.name)}`);
  }
  return items;
}

/** The DOM interface of a root element, for the signature's `Element`. */
function elementType(tag: string): string {
  return tag === "svg" ? "SVGSVGElement" : `HTMLElementTagNameMap["${tag}"]`;
}

/** Glimmer's own spelling of a literal, or `undefined` when code is no literal Glimmer has. */
function glimmerLiteral(code: string): string | undefined {
  if (/^(?:true|false|null|undefined)$/.test(code)) return code;
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(code)) return code;
  // A string without quotes or backslashes inside: Glimmer reads no escapes.
  const string = /^"([^"\\]*)"$/.exec(code) ?? /^'([^'\\]*)'$/.exec(code);
  if (string) return JSON.stringify(string[1]);
  return undefined;
}

function indent(text: string): string {
  return text
    .split("\n")
    .map((line) => (line ? `  ${line}` : line))
    .join("\n");
}

type HelperName =
  | "afterRender"
  | "Composable"
  | "AsyncSetup"
  | "directive"
  | "inject"
  | "provider"
  | "refOf"
  | "callbacks"
  | "classNames"
  | "componentRef"
  | "Effect"
  | "modelText"
  | "enumeratedValue"
  | "fallthroughStyle"
  | "registerDestructor"
  | "renderSettled"
  | "sources"
  | "styleText"
  | "teleportTarget"
  | "templateRef"
  | "transition"
  | "toggle"
  | "useId"
  | "Watcher";

/** What each module helper imports from Ember, by module: a `type ` name is a type. */
const HELPER_IMPORTS: Record<HelperName, Record<string, readonly string[]>> = {
  afterRender: { "@ember/destroyable": ["isDestroying"], "@ember/renderer": ["renderSettled"] },
  AsyncSetup: { "@ember/destroyable": ["isDestroying"] },
  Composable: {},
  directive: DIRECTIVE_IMPORTS,
  inject: {},
  provider: {},
  refOf: {},
  callbacks: {},
  classNames: {},
  componentRef: {},
  fallthroughStyle: {},
  Effect: {
    "@ember/destroyable": ["isDestroying", "registerDestructor"],
    "@ember/renderer": ["renderSettled"],
  },
  enumeratedValue: {},
  registerDestructor: { "@ember/destroyable": ["registerDestructor"] },
  renderSettled: { "@ember/renderer": ["renderSettled"] },
  useId: { "@ember/owner": ["getOwner"] },
  modelText: {
    "@ember/modifier": ["capabilities", "setModifierManager"],
    "@glint/template": ["type ModifierLike"],
  },
  toggle: {},
  sources: {},
  styleText: {},
  teleportTarget: {},
  transition: TRANSITION_IMPORTS,
  templateRef: {
    "@ember/modifier": ["capabilities", "setModifierManager"],
    "@glint/template": ["type ModifierLike"],
  },
  Watcher: {
    "@ember/destroyable": ["isDestroying", "registerDestructor"],
    "@ember/renderer": ["renderSettled"],
  },
};

/** The module helpers, after the component. */
const HELPERS: Record<HelperName, string> = {
  directive: directiveHelpers().join("\n\n"),
  provider: `/**
 * Vue's \`provide\`: a text node, first in the component's root, that holds each provided value
 * under its key. The root's descendants find it, and no sibling of the root does (\`inject\`).
 */
function provider(entries: readonly (readonly [symbol, unknown])[]): Text {
  const marker = document.createTextNode("");
  for (const [key, value] of entries) Reflect.set(marker, key, value);
  return marker;
}`,
  inject: `/**
 * Vue's \`inject\`: the value of the nearest provider above \`marker\`, or the fallback. Ember
 * has no context API yet (RFC 1200), so this walks the DOM, as ember-primitives' dom-context
 * does: each ancestor and the nodes before it, where a provider's marker sits.
 */
function inject<T>(marker: Node, key: symbol, fallback: T): T {
  for (let parent: Node | null = marker; parent; parent = parent.parentNode) {
    for (let node = parent.previousSibling; node; node = node.previousSibling) {
      if (Reflect.has(node, key)) return Reflect.get(node, key) as T;
    }
  }
  return fallback;
}`,
  refOf: `/** A provided state as its consumers read a ref: a \`value\` getter over the tracked field. */
function refOf<T>(read: () => T): { readonly value: T } {
  return {
    get value() {
      return read();
    },
  };
}`,
  afterRender: `/** Runs \`run\` once the render settles, unless its component is gone by then. */
function afterRender(owner: object, run: () => unknown): void {
  // A component on the server never mounts, as Vue registers no hook in a server render.
  if (import.meta.env.SSR) return;
  void renderSettled().then(() => {
    if (!isDestroying(owner)) void run();
  });
}`,
  registerDestructor: "",
  renderSettled: "",
  useId: `/** How many ids each application gave, by its owner. */
const ids = new WeakMap<object, number>();

/**
 * Vue's \`useId\`: an id unique within the component's application. The server and the client
 * that hydrates its render create the components in the same order, so each gets the same id on
 * both, which a random id would not.
 */
function useId(component: object): string {
  const owner = getOwner(component) ?? component;
  const count = ids.get(owner) ?? 0;
  ids.set(owner, count + 1);
  return \`uf-id-\${count}\`;
}`,
  toggle: `/** The values with \`value\` added when \`checked\`, and removed otherwise. */
function toggle<T>(values: readonly T[], value: T, checked: boolean): T[] {
  return checked ? values.concat([value]) : values.filter((each) => each !== value);
}`,
  modelText: `/**
 * A modifier that binds a text field as Vue's \`vModelText\` does: it writes what the user types,
 * trimmed or cast as \`looseToNumber\` casts it, on \`input\` or, when lazy, on \`change\`, and
 * shows each new value of the state, except where the text already reads as it, or while the
 * user types in a trimmed field what it reads as trimmed.
 */
const modelText = setModifierManager(
  () => ({
    capabilities: capabilities("3.22"),
    createModifier: (): ModelTextState => ({ setValue: () => {} }),
    installModifier(state: ModelTextState, element: Element, { positional, named }: ModelTextArgs) {
      const field = element as HTMLInputElement | HTMLTextAreaElement;
      state.field = field;
      state.setValue = positional[1];
      const read = () => {
        const text = named.trim ? field.value.trim() : field.value;
        return named.number ? looseToNumber(text) : text;
      };
      field.addEventListener(named.lazy ? "change" : "input", () => state.setValue(read()));
      if (named.trim || named.number) {
        field.addEventListener("change", () => {
          field.value = String(read());
        });
      }
      show(field, positional[0], named);
    },
    updateModifier(state: ModelTextState, { positional, named }: ModelTextArgs) {
      state.setValue = positional[1];
      if (state.field) show(state.field, positional[0], named);
    },
    destroyModifier() {},
  }),
  {},
) as unknown as ModifierLike<{
  Element: HTMLInputElement | HTMLTextAreaElement;
  Args: {
    Positional: [value: unknown, setValue: (value: never) => void];
    Named: { trim?: boolean; lazy?: boolean; number?: boolean };
  };
}>;

/** What \`modelText\` keeps of its field. */
interface ModelTextState {
  field?: HTMLInputElement | HTMLTextAreaElement;
  setValue: (value: unknown) => void;
}

/** What \`modelText\`'s manager is given. */
interface ModelTextArgs {
  positional: readonly [unknown, (value: unknown) => void];
  named: { trim?: boolean; lazy?: boolean; number?: boolean };
}

/** A text as a number where it reads as one, as Vue's \`looseToNumber\` casts it. */
function looseToNumber(text: string): string | number {
  const number = Number.parseFloat(text);
  return Number.isNaN(number) ? text : number;
}

/** Shows a state's value in a field, as \`vModelText\`'s update does. */
function show(
  field: HTMLInputElement | HTMLTextAreaElement,
  value: unknown,
  named: { trim?: boolean; number?: boolean },
): void {
  const next = value ?? "";
  const shown = named.number && !/^0\\d/.test(field.value) ? looseToNumber(field.value) : field.value;
  if (shown === next) return;
  const typing = document.activeElement === field && field.type !== "range";
  if (typing && named.trim && field.value.trim() === next) return;
  field.value = String(next);
}`,
  callbacks: `/** How many watchers' callbacks are to run once the current render is done. */
const callbacks = { pending: 0 };`,
  sources: `/** An array of watch sources, typed as a tuple. */
function sources<T extends unknown[]>(...values: T): T {
  return values;
}`,
  templateRef: `/** A modifier that sets a member of its component to its element while the element is rendered. */
const templateRef = setModifierManager(
  () => ({
    capabilities: capabilities("3.22"),
    createModifier: () => ({}),
    installModifier(_state: object, element: Element, { positional }: { positional: readonly unknown[] }) {
      Reflect.set(positional[0] as object, positional[1] as string, element);
    },
    updateModifier() {},
    destroyModifier(_state: object, { positional }: { positional: readonly unknown[] }) {
      Reflect.set(positional[0] as object, positional[1] as string, null);
    },
  }),
  {},
) as unknown as ModifierLike<{ Element: Element; Args: { Positional: [owner: object, name: string] } }>;`,
  Watcher: `/**
 * Vue's \`watch\`: the template calls \`flush\` before anything else, so it sees a change of a
 * source in the render that follows it, and the callback runs right after that render, or once
 * the render settles for a \`post\` watcher. A cleanup the callback registers runs before its
 * next run, and when the component is destroyed.
 */
class Watcher<T> {
  readonly #owner: object;
  readonly #source: () => T;
  readonly #callback: (value: T, previous: T, onCleanup: (cleanup: () => void) => void) => unknown;
  readonly #options: { array?: boolean; immediate?: boolean; post?: boolean };
  #started = false;
  #value: T | undefined;
  #cleanup: (() => void) | undefined;

  constructor(
    owner: object,
    source: () => T,
    callback: (value: T, previous: T, onCleanup: (cleanup: () => void) => void) => unknown,
    options: { array?: boolean; immediate?: boolean; post?: boolean } = {},
  ) {
    this.#owner = owner;
    this.#source = source;
    this.#callback = callback;
    this.#options = options;
    registerDestructor(owner, () => this.#cleanup?.());
  }

  readonly flush = (): undefined => {
    const value = this.#source();
    const started = this.#started;
    // On the server a watcher runs at most its immediate first run, as Vue's does.
    if (import.meta.env.SSR && started) return undefined;
    if (started && this.#same(value, this.#value as T)) return undefined;
    const previous = (started ? this.#value : this.#options.array ? [] : undefined) as T;
    this.#started = true;
    this.#value = value;
    if (!started && !this.#options.immediate) return undefined;
    const run = () => {
      const cleanup = this.#cleanup;
      this.#cleanup = undefined;
      cleanup?.();
      void this.#callback(value, previous, (each) => {
        this.#cleanup = each;
      });
    };
    // The render that calls \`flush\` has read what the callback may write, so the callback
    // runs right after it, or once the render settles for a \`post\` watcher.
    const later = () => {
      if (!isDestroying(this.#owner)) run();
    };
    if (this.#options.post) void renderSettled().then(later);
    else {
      callbacks.pending += 1;
      queueMicrotask(() => {
        callbacks.pending -= 1;
        later();
      });
    }
    return undefined;
  };

  #same(value: T, previous: T): boolean {
    if (!this.#options.array) return Object.is(value, previous);
    const values = value as unknown[];
    const previousValues = previous as unknown[];
    return values.every((each, index) => Object.is(each, previousValues[index]));
  }
}`,
  Effect: `/**
 * Vue's \`watchEffect\`: the template calls \`flush\` after everything else, so the effect runs
 * once the component has rendered in the browser, and again when what it read changes. A
 * cleanup it registers runs before its next run, and when the component is destroyed.
 */
class Effect {
  @tracked ready = false;
  readonly #owner: object;
  readonly #effect: (onCleanup: (cleanup: () => void) => void) => unknown;
  #cleanup: (() => void) | undefined;

  constructor(owner: object, effect: (onCleanup: (cleanup: () => void) => void) => unknown) {
    this.#owner = owner;
    this.#effect = effect;
    registerDestructor(owner, () => this.#cleanup?.());
    void renderSettled().then(() => {
      if (!isDestroying(owner)) this.ready = true;
    });
  }

  readonly flush = (): undefined => {
    if (!this.ready) return undefined;
    // A watcher's callback is still to run after this render: the effect runs once after it,
    // and sees what it writes. Writing \`ready\` again renders this call again then.
    if (callbacks.pending) {
      queueMicrotask(() => {
        if (!isDestroying(this.#owner)) this.ready = true;
      });
      return undefined;
    }
    const cleanup = this.#cleanup;
    this.#cleanup = undefined;
    cleanup?.();
    void this.#effect((each) => {
      this.#cleanup = each;
    });
    return undefined;
  };
}`,
  classNames: `/** A class as clsx builds it: strings, arrays and toggle objects, empty tokens left out. */
function classNames(...values: unknown[]): string | undefined {
  const tokens: string[] = [];
  const add = (value: unknown): void => {
    if (!value) return;
    if (typeof value === "string" || typeof value === "number") tokens.push(String(value));
    else if (Array.isArray(value)) for (const each of value) add(each);
    else if (typeof value === "object") {
      for (const [name, on] of Object.entries(value)) if (on) tokens.push(name);
    }
  };
  for (const value of values) add(value);
  return tokens.length ? tokens.join(" ") : undefined;
}`,
  enumeratedValue: `/** An enumerated attribute's value: a boolean as its name, any other value as it is. */
function enumeratedValue<T>(value: T): Exclude<T, boolean> | "true" | "false" {
  return typeof value === "boolean" ? (String(value) as "true" | "false") : (value as Exclude<T, boolean>);
}`,
  fallthroughStyle: FALLTHROUGH_STYLE,
  transition: TRANSITION_HELPERS,
  Composable: `/** A composable's state: the component that called it, which its hooks run with, and its arguments. */
class Composable<Args> {
  readonly owner: object;
  readonly args: Args;

  constructor(owner: object, args: Args) {
    this.owner = owner;
    this.args = args;
  }
}`,
  AsyncSetup: `/**
 * A component's async setup (Vue's \`async setup\` under \`<Suspense>\`): it runs as the
 * component is constructed, and \`resolved\` holds once it has, which the template waits for.
 * A component destroyed while it waits runs no more of it.
 */
class AsyncSetup {
  @tracked resolved = false;

  constructor(owner: object, run: () => Promise<void>) {
    void run().then(() => {
      if (!isDestroying(owner)) this.resolved = true;
    });
  }
}`,
  teleportTarget: `/** The element a \`<Teleport to>\` selects, in the browser only: the server renders no teleport. */
function teleportTarget(to: string): Element | undefined {
  return import.meta.env.SSR ? undefined : (document.querySelector(to) ?? undefined);
}`,
  componentRef: `/** Sets a member of its component to what a child exposes, or to \`null\` once the child is gone. */
function componentRef(owner: object, name: string): (exposed: unknown) => void {
  return (exposed) => void Reflect.set(owner, name, exposed);
}`,
  styleText: `/**
 * A style from its declarations, those whose value is nullish left out, marked safe. A
 * declaration without a property is a whole style: a declaration list, or an object whose keys
 * may be in camel case, as Vue's \`normalizeStyle\` reads them.
 */
function styleText(
  declarations: readonly (readonly [string, unknown])[],
): ReturnType<typeof htmlSafe> | undefined {
  const parts: string[] = [];
  const add = (property: string, value: unknown): void => {
    if (value === undefined || value === null) return;
    if (property) parts.push(\`\${property}: \${String(value)}\`);
    else if (typeof value === "string") parts.push(value.trim().replace(/;$/, ""));
    else if (typeof value === "object") {
      for (const [key, each] of Object.entries(value)) {
        add(key.startsWith("--") ? key : key.replace(/[A-Z]/g, (letter) => \`-\${letter.toLowerCase()}\`), each);
      }
    }
  };
  for (const [property, value] of declarations) add(property, value);
  const text = parts.filter(Boolean).join("; ");
  return text ? htmlSafe(text) : undefined;
}`,
} as const;
