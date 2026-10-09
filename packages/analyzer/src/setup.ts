// The setup (plan §4.2, ADR-0045): every statement of a component's body before its return,
// classified in source order into the IR's setup items and bindings. Nothing is copied unanalysed
// (P2): a statement outside the subset is reported, and the code of each item is walked in the
// context it runs in (`./expressions.ts`). The setup is read in two passes. The first declares
// every binding and the events, so that any code can read any binding (client code reads what is
// declared after it); the second walks each item's code, in source order, so that what a getter
// or an initial value reads is known when it reads it.

import type { Fix } from "@unframework/diagnostics";
import {
  createBinding,
  createBindingReference,
  createCode,
  createConstItem,
  createDerivedItem,
  createEmits,
  createEventDeclaration,
  createEventParameter,
  createExposes,
  createExpression,
  createFunctionItem,
  createGetterSource,
  createIdItem,
  createInjectItem,
  createLifecycleItem,
  createModelItem,
  createProvideItem,
  createRefSource,
  createSlotDeclaration,
  createSlots,
  createStateItem,
  createTemplateRefItem,
  createTypeText,
  createVariableItem,
  createWatchEffectItem,
  createWatchItem,
  DOM_EVENTS,
  EVENT_INTERFACES,
  extendsEventInterface,
  reservedEventName,
  reservedParameterName,
  reservedSetupName,
} from "@unframework/ir";
import type {
  Binding,
  Code,
  Emits,
  EventDeclaration,
  Exposes,
  RefType,
  SetupItem,
  SlotDeclaration,
  Slots,
  TypeText,
  WatchSource,
} from "@unframework/ir";
import type { AST } from "@unframework/parser";
import { visitorKeys } from "@unframework/parser";

import { inheritAttrsOption } from "./api.ts";
import type { AuthoringApi } from "./authoring.ts";
import { Reporter } from "./context.ts";
import { checkCopiedText, checkMembers, checkType, closure } from "./declarations.ts";
import type { ModuleTypes } from "./declarations.ts";
import { checkCode, checkDirectives, lowerFunction, span } from "./expressions.ts";
import { annotatedInterface, listenerName } from "./listeners.ts";
import { isStatic } from "./props.ts";
import type { PropsAnalysis } from "./props.ts";
import type {
  ComponentFunction,
  EventParameter,
  EventPayload,
  RenderContext,
  SetupBinding,
  SetupFunction,
  SetupScope,
} from "./render.ts";
import { setupBindingOf } from "./render.ts";
import type { Scopes } from "./scope.ts";
import type { TypeTable } from "./types/from-type.ts";
import {
  FUNCTION,
  has,
  mayBeNullish,
  NULL,
  STRING,
  union,
  UNDEFINED,
  UNKNOWN,
} from "./types/kinds.ts";

/** What declaring a component's setup needs to know. */
export interface SetupContext {
  readonly source: string;
  readonly reporter: Reporter;
  readonly scopes: Scopes;
  readonly types: TypeTable;
  readonly comments: readonly AST.Comment[];
  /** The module's authoring imports, by the identifier that declares each. */
  readonly authoring: ReadonlyMap<object, AuthoringApi | undefined>;
  readonly component: ComponentFunction;
  readonly props: PropsAnalysis;
  /** The statements of the body before its return. */
  readonly statements: readonly (AST.Directive | AST.Statement)[];
  /** The JSX the component returns, whose handlers decide which parameters take an event. */
  readonly returned: AST.Expression | undefined;
  /** The injection keys the module declares or imports, by the identifier that declares each. */
  readonly keys: ReadonlyMap<object, InjectionKeyInfo>;
}

/** A component's setup, declared: its bindings, and what lowers its items. */
export interface Setup {
  readonly scope: SetupScope;
  /** The setup's bindings, `emit`'s included, in source order. */
  readonly bindings: Binding[];
  /** The items, once `lower` has walked them, in source order. */
  readonly items: SetupItem[];
  /** The events `defineEmits` declares. */
  readonly emits: Emits | undefined;
  /** The slots `defineSlots` declares (ADR-0054). */
  readonly slots: Slots | undefined;
  /** The local functions `defineExpose` exposes (ADR-0054). */
  readonly exposes: Exposes | undefined;
  /** `false` where `defineOptions({ inheritAttrs: false })` turns fallthrough off. */
  readonly inheritAttrs: boolean;
  /** What each lowered item is written as, for the rules judged once everything is lowered. */
  readonly sources: ReadonlyMap<SetupItem, ItemSource>;
  /** Walks each item's code, in source order, once the render context is ready. */
  lower(render: RenderContext): void;
  /** Checks what the render tree must do for the setup: attach each template ref (UF3027). */
  finish(render: RenderContext): void;
}

/** A statement the first pass classified, with what the second pass lowers it from. */
type Declared =
  | {
      kind: "state" | "derived" | "templateRef" | "id";
      statement: AST.Statement;
      call: AST.CallExpression;
      binding: SetupBinding;
    }
  | {
      kind: "const" | "let";
      statement: AST.VariableDeclaration;
      declarator: AST.VariableDeclarator;
      binding: SetupBinding;
    }
  | {
      kind: "function";
      statement: AST.Statement;
      fn: SetupFunction;
      form: "declaration" | "arrow";
      binding: SetupBinding;
    }
  | { kind: "watch" | "watchEffect"; statement: AST.Statement; call: AST.CallExpression }
  | {
      kind: "lifecycle";
      statement: AST.Statement;
      call: AST.CallExpression;
      hook: "mounted" | "unmounted";
    }
  | {
      kind: "model";
      statement: AST.Statement;
      call: AST.CallExpression;
      binding: SetupBinding;
      name: string;
      options: ModelOptions;
    }
  | {
      kind: "inject";
      statement: AST.Statement;
      call: AST.CallExpression;
      binding: SetupBinding;
      key: InjectionKeyInfo;
    }
  | { kind: "provide"; statement: AST.Statement; call: AST.CallExpression; key: InjectionKeyInfo };

/** What `defineModel`'s options object holds, once checked (UF2028). */
interface ModelOptions {
  default?: AST.Expression;
  required?: true;
}

/**
 * An injection key `provide` and `inject` may name (ADR-0054): one the module declares, or one it
 * imports from another `.uf.tsx` module, by its local name, with its value's type: the node for
 * the module's own, the text the resolver gave for an imported one.
 */
export interface InjectionKeyInfo {
  readonly name: string;
  readonly type: AST.TSType | string;
  /** The authoring type of the ref the key holds, read from its declaration's AST. */
  readonly ref?: RefType;
}

/** The macros whose result is bound (plan §4.2): their results are the setup's bindings. */
const BOUND_MACROS: ReadonlySet<AuthoringApi> = new Set([
  "ref",
  "computed",
  "useTemplateRef",
  "useId",
  "defineEmits",
  "defineSlots",
  "defineModel",
  "inject",
]);

/**
 * Declares a component's setup (ADR-0045): classifies each statement before the return, creates
 * the bindings, reads the events `defineEmits` declares, and finds the parameters that receive an
 * event; `lower` then walks the items' code.
 */
export function declareSetup(context: SetupContext): Setup {
  const { source, reporter, comments, statements } = context;
  const mark = reporter.diagnostics.length;
  const bindings = new Map<object, SetupBinding>();
  const declared: Declared[] = [];
  const items: SetupItem[] = [];
  let emits: Emits | undefined;
  let events: Map<string, EventPayload> | undefined;
  let slots: Slots | undefined;
  /** The `defineSlots` call, once seen: a second one is UF2029. */
  let slotsCall: AST.CallExpression | undefined;
  /** The `defineExpose` call, checked once every binding is declared. */
  let exposeCall: AST.CallExpression | undefined;
  let exposes: Exposes | undefined;
  let optionsCall: AST.CallExpression | undefined;
  let inheritAttrs = true;
  /** Each model's name, with the argument that names it (UF2028). */
  const models = new Map<string, AST.Expression>();
  /** The keys the component injects and provides, by name, with the call that names each. */
  const injected = new Map<string, AST.CallExpression>();
  const provided = new Map<string, AST.CallExpression>();
  /** The slots' names, with the key that declares each, checked against the events at the end. */
  const slotKeys: { name: string; key: AST.PropertyKey }[] = [];
  /** The identifier the `emit` binding is declared by, once its events are read. */
  let emitBinding: AST.BindingIdentifier | undefined;
  /** The events' names, with the key that declares each (UF2008). */
  const named: { name: string; key: AST.PropertyKey }[] = [];
  /** Whether each payload member admits `null` or `undefined`, by its IR (UF3031). */
  const nullable = new Map<object, boolean>();
  const eventParameters = new Map<SetupFunction, EventParameter>();

  /** Declares a binding the setup holds, checking its name (UF2003). */
  const declare = (
    id: AST.BindingIdentifier,
    kind: SetupBinding["kind"],
    kinds = UNKNOWN,
    fn?: SetupFunction,
  ): SetupBinding => {
    const { name } = id;
    const reserved = reservedSetupName(name);
    const prop = context.props.object ? context.props.byName.get(name) : undefined;
    if (reserved || prop) {
      reporter.report(
        "UF2003",
        { start: id.start, end: id.start + name.length },
        reserved
          ? `\`${name}\` cannot name a binding of the setup: ${reserved}.`
          : `\`${name}\` is also a prop's name: Angular's output declares both as members of one class.`,
        { help: "Rename it." },
      );
    }
    const binding: SetupBinding = {
      name,
      id: createBinding(name, kind, { start: id.start, end: id.start + name.length }).id,
      kind,
      kinds,
      declaration: id,
      ...(fn ? { function: fn } : {}),
    };
    bindings.set(id, binding);
    return binding;
  };

  /** The authoring API a callee is, `undefined` for an import that does not give one, or `null`. */
  const apiOf = (callee: AST.Expression | AST.Super): AuthoringApi | undefined | null => {
    if (callee.type !== "Identifier") return null;
    const resolution = context.scopes.resolve(callee);
    if (resolution.kind !== "import" || !context.authoring.has(resolution.declaration)) return null;
    return context.authoring.get(resolution.declaration);
  };

  for (const statement of statements) {
    checkCopiedText(span(statement), source, reporter, "Setup code");
    checkDirectives(span(statement), comments, reporter);
    if (isDirective(statement)) {
      checkDirective(statement, reporter);
      continue;
    }
    switch (statement.type) {
      case "ExpressionStatement": {
        const { expression } = statement;
        const api = expression.type === "CallExpression" ? apiOf(expression.callee) : null;
        if (api === undefined) continue;
        if (api === null) {
          other(statement);
          continue;
        }
        const call = expression as AST.CallExpression;
        if (api === "watch" || api === "watchEffect") declared.push({ kind: api, statement, call });
        else if (api === "onMounted" || api === "onUnmounted") {
          declared.push({
            kind: "lifecycle",
            statement,
            call,
            hook: api === "onMounted" ? "mounted" : "unmounted",
          });
        } else if (api === "defineExpose") defineExpose(call);
        else if (api === "defineOptions") defineOptions(call);
        else if (api === "provide") provide(statement, call);
        else if (BOUND_MACROS.has(api)) unbound(call, api, "statement");
        else misplacedNextTick(call.callee as AST.IdentifierReference);
        continue;
      }
      case "VariableDeclaration":
        variable(statement);
        continue;
      case "FunctionDeclaration": {
        if (!statement.id) continue;
        if (helper(statement, statement.id)) continue;
        const binding = declare(statement.id, "localFn", returnKinds(statement), statement);
        declared.push({ kind: "function", statement, fn: statement, form: "declaration", binding });
        continue;
      }
      case "ReturnStatement":
        conditionalReturn(statement);
        continue;
      default:
        other(statement);
    }
  }

  /** A `const` or `let` at the top level of the body. */
  function variable(statement: AST.VariableDeclaration): void {
    if (statement.kind !== "const" && statement.kind !== "let") {
      reporter.unsupported(
        statement,
        `\`${statement.kind}\` is not supported in the setup: declare a constant with \`const\`, state with \`ref\`, and what no template reads with \`let\`.`,
      );
      return;
    }
    // JSX kept in a variable is outside every template (UF3012), whatever else holds it; a
    // function that returns it is a helper, reported as one.
    const jsx = statement.declarations.filter(
      (declarator) =>
        holdsJsx(declarator.init) &&
        declarator.init?.type !== "ArrowFunctionExpression" &&
        declarator.init?.type !== "FunctionExpression",
    );
    for (const declarator of jsx) {
      reporter.report(
        "UF3012",
        declarator.init!,
        "JSX cannot be kept in a variable: Vue's, Svelte's and Angular's templates have no counterpart for it.",
        { help: "Write the JSX where it renders, in the returned tree, or extract a component." },
      );
    }
    if (jsx.length) return;
    if (statement.declarations.length > 1) {
      reporter.unsupported(
        statement,
        "Declaring several names in one statement is not supported in the setup: declare each with a statement of its own.",
      );
      return;
    }
    const declarator = statement.declarations[0]!;
    const { id, init } = declarator;
    const call = init?.type === "CallExpression" ? init : undefined;
    const api = call ? apiOf(call.callee) : null;
    if (api === undefined) return;
    if (api !== null) {
      macro(statement, declarator, call!, api);
      return;
    }
    if (id.type !== "Identifier") {
      reporter.unsupported(
        id,
        "Destructuring is not supported in the setup yet: declare each name with a `const` of its own.",
      );
      return;
    }
    if (statement.kind === "let") {
      const nothing =
        !init ||
        (init.type === "Literal" && init.value === null && !("regex" in init && init.regex)) ||
        (init.type === "Identifier" && init.name === "undefined");
      if (!id.typeAnnotation && nothing) {
        reporter.report(
          "UF2021",
          id,
          `\`${id.name}\` is a setup \`let\` with neither a type nor an initial value that gives it one: the outputs that declare it (React's \`useRef\`, Angular's field) cannot type it.`,
          {
            help: `Annotate it, as in \`let ${id.name}: ReturnType<typeof setTimeout> | undefined;\`, or give it an initial value.`,
          },
        );
      }
      const kinds = id.typeAnnotation
        ? context.types.kindsOf(id.typeAnnotation.typeAnnotation)
        : UNKNOWN;
      // A `let` holds `undefined` until code assigns it: React's `useRef` and Qwik's `useSignal`
      // start it so, and type it so, whatever the annotation claims (`let started!: number`).
      const annotation = id.typeAnnotation?.typeAnnotation;
      if (
        annotation &&
        !init &&
        !has(kinds, "undefined") &&
        annotation.type !== "TSAnyKeyword" &&
        annotation.type !== "TSUnknownKeyword"
      ) {
        reporter.report(
          "UF2021",
          declarator,
          `\`${id.name}\` is a setup \`let\` without an initial value, whose type leaves out \`undefined\`: it holds \`undefined\` until code assigns it, and the outputs that declare it so (React's \`useRef\`, Qwik's \`useSignal\`) type it with \`| undefined\`, which the code that reads it does not expect.`,
          {
            help: `Give it an initial value, or add \`| undefined\` to its type: \`let ${id.name}: ${source.slice(annotation.start, annotation.end)} | undefined;\`.`,
          },
        );
      }
      const binding = declare(id, "localVar", kinds);
      declared.push({ kind: "let", statement, declarator, binding });
      return;
    }
    if (init?.type === "ArrowFunctionExpression") {
      if (helper(init, id)) return;
      const binding = declare(id, "localFn", returnKinds(init), init);
      declared.push({ kind: "function", statement, fn: init, form: "arrow", binding });
      return;
    }
    if (init?.type === "FunctionExpression") {
      reporter.unsupported(
        init,
        "Function expressions are not supported in the setup: write a function declaration or an arrow function.",
      );
      return;
    }
    const kinds = id.typeAnnotation
      ? context.types.kindsOf(id.typeAnnotation.typeAnnotation)
      : UNKNOWN;
    const binding = declare(id, "localConst", kinds);
    declared.push({ kind: "const", statement, declarator, binding });
  }

  /** The kinds a local function's annotated return type gives, before its body is walked. */
  function returnKinds(fn: SetupFunction): typeof UNKNOWN {
    return fn.returnType ? context.types.kindsOf(fn.returnType.typeAnnotation) : UNKNOWN;
  }

  /** A declaration whose value is an authoring API's call. */
  function macro(
    statement: AST.VariableDeclaration,
    declarator: AST.VariableDeclarator,
    call: AST.CallExpression,
    api: AuthoringApi,
  ): void {
    const { id } = declarator;
    if (BOUND_MACROS.has(api) && (statement.kind !== "const" || id.type !== "Identifier")) {
      unbound(call, api, statement.kind !== "const" ? "let" : "pattern");
      return;
    }
    if (id.type !== "Identifier") {
      reporter.unsupported(id, "Destructuring is not supported in the setup.");
      return;
    }
    switch (api) {
      case "ref": {
        if (!arguments_(call, 0, 1, 1)) return;
        const [type] = call.typeArguments?.params ?? [];
        if (!type && !call.arguments.length) {
          reporter.report(
            "UF2021",
            call,
            `\`${id.name}\` is state with neither a type nor an initial value: \`ref()\` holds \`undefined\` as far as the outputs that type their state can tell (React's \`useState\`, Angular's \`signal\`), which then take no other value.`,
            { help: "Give it a type argument: `const selected = ref<string>();`." },
          );
        }
        const kinds = type
          ? call.arguments.length
            ? context.types.kindsOf(type)
            : union(context.types.kindsOf(type), UNDEFINED)
          : call.arguments.length
            ? UNKNOWN
            : UNDEFINED;
        declared.push({ kind: "state", statement, call, binding: declare(id, "state", kinds) });
        return;
      }
      case "computed": {
        if (!arguments_(call, 1, 1, 1)) return;
        const [getter] = call.arguments;
        if (getter?.type === "Identifier") {
          reporter.report(
            "UF2022",
            getter,
            `\`${getter.name}\` is passed to \`computed\` by name: a getter is written in place, which the targets write into their own derived value (React's \`useMemo\`, Qwik's \`useComputed$\`).`,
            { help: "Write the getter in place: `computed(() => …)`." },
          );
          return;
        }
        if (getter?.type !== "ArrowFunctionExpression") {
          reporter.unsupported(
            getter!,
            "A `computed` getter is written in place, as an arrow function: `computed(() => …)`.",
          );
          return;
        }
        const [type] = call.typeArguments?.params ?? [];
        const kinds = type ? context.types.kindsOf(type) : UNKNOWN;
        declared.push({ kind: "derived", statement, call, binding: declare(id, "derived", kinds) });
        return;
      }
      case "useTemplateRef": {
        if (!arguments_(call, 0, 0, 1)) return;
        const [type] = call.typeArguments?.params ?? [];
        const kinds = union(type ? context.types.kindsOf(type) : UNKNOWN, NULL);
        declared.push({
          kind: "templateRef",
          statement,
          call,
          binding: declare(id, "templateRef", kinds),
        });
        return;
      }
      case "useId":
        if (!arguments_(call, 0, 0, 0)) return;
        declared.push({ kind: "id", statement, call, binding: declare(id, "localConst", STRING) });
        return;
      case "defineEmits":
        defineEmits(statement, id, call);
        return;
      case "defineSlots":
        defineSlots(statement, id, call);
        return;
      case "defineModel":
        defineModel(statement, id, call);
        return;
      case "inject":
        inject(statement, id, call);
        return;
      case "defineExpose":
      case "defineOptions":
      case "provide":
        reporter.report(
          "UF2005",
          call.callee,
          `\`${(call.callee as AST.IdentifierReference).name}\` returns nothing: it is called as a statement of its own, at the top level of the component's body.`,
          {
            help: `Write \`${(call.callee as AST.IdentifierReference).name}({ … });\`.`,
          },
        );
        return;
      case "watch":
      case "watchEffect":
        reporter.unsupported(
          call,
          `A watcher's stop handle is not supported yet: call \`${call.callee.type === "Identifier" ? call.callee.name : api}(…)\` as a statement.`,
        );
        return;
      case "onMounted":
      case "onUnmounted":
        reporter.report(
          "UF2005",
          call.callee,
          `\`${(call.callee as AST.IdentifierReference).name}\` returns nothing: it is called as a statement of its own, at the top level of the component's body.`,
          { help: `Write \`${(call.callee as AST.IdentifierReference).name}(() => { … });\`.` },
        );
        return;
      case "nextTick":
        misplacedNextTick(call.callee as AST.IdentifierReference);
        return;
      default:
        unreachable(api);
    }
  }

  /**
   * Checks a macro's arguments: how many it takes, and how many type arguments. Returns whether
   * they are what it takes (UF1002 otherwise: the authoring types reject the rest).
   */
  function arguments_(call: AST.CallExpression, min: number, max: number, types: number): boolean {
    const name = call.callee.type === "Identifier" ? call.callee.name : "";
    const count = call.arguments.length;
    const spread = call.arguments.find((argument) => argument.type === "SpreadElement");
    const typeCount = call.typeArguments?.params.length ?? 0;
    if (spread || count < min || count > max || typeCount > types) {
      reporter.unsupported(
        spread ?? call,
        `\`${name}\` takes ${min === max ? `${min}` : `${min} or ${max}`} argument${max === 1 ? "" : "s"}${types ? ` and at most ${types} type argument` : " and no type arguments"}, none spread.`,
      );
      return false;
    }
    return true;
  }

  /** A macro whose result is not bound by a top-level `const` (UF2006). */
  function unbound(
    call: AST.CallExpression,
    api: AuthoringApi,
    how: "statement" | "let" | "pattern",
  ) {
    const name = (call.callee as AST.IdentifierReference).name;
    const fixes: Fix[] = [];
    if (api === "defineEmits" && how === "statement" && free("emit")) {
      fixes.push({
        title: "Bind it as `const emit`",
        confidence: "likely",
        edits: [{ span: { start: call.start, end: call.start }, text: "const emit = " }],
      });
    }
    reporter.report(
      "UF2006",
      call,
      how === "statement"
        ? api === "defineEmits"
          ? `\`${name}\` returns the component's \`emit\`, which nothing binds: a macro's result is bound by a \`const\` at the top level of the component's body.`
          : `\`${name}(…)\`'s result is nothing without a binding: a macro's result is bound by a \`const\` at the top level of the component's body.`
        : how === "let"
          ? `\`${name}(…)\`'s result is bound by \`let\`: a macro's result is bound once, by a \`const\`, since every target declares it once.`
          : `\`${name}(…)\`'s result is destructured: a macro's result is bound whole, by a \`const\`, since a ref's value is read through it.`,
      {
        help:
          api === "defineEmits"
            ? "Bind it: `const emit = defineEmits<{ … }>();`."
            : `Bind it: \`const value = ${name}(…);\`.`,
        ...(fixes.length ? { fixes } : {}),
      },
    );
  }

  /** Whether a name is free in the component: nothing in it is named so. */
  function free(name: string): boolean {
    const text = source.slice(context.component.start, context.component.end);
    return !new RegExp(`(?<![\\w$])${name}(?![\\w$])`).test(text);
  }

  /** `nextTick` at the top level of the body, which is no client code (UF2005). */
  function misplacedNextTick(callee: AST.IdentifierReference): void {
    reporter.report(
      "UF2005",
      callee,
      "`nextTick` waits for the DOM to update, so only client code calls it: a handler, a watcher's callback, `watchEffect`, a lifecycle hook or a function they call.",
      { help: "Call it in a handler or a lifecycle hook, as `await nextTick()`." },
    );
  }

  /**
   * `const emit = defineEmits<{ change: [value: number] }>()` (ADR-0047): one type argument, a
   * type literal or a local type of one, whose members are events with named tuples (UF2009).
   */
  function defineEmits(
    statement: AST.VariableDeclaration,
    id: AST.BindingIdentifier,
    call: AST.CallExpression,
  ): void {
    const binding = declare(id, "emit", FUNCTION);
    const invalid = (at: { start: number; end: number }, message: string, help?: string) => {
      reporter.report("UF2009", at, message, {
        help:
          help ??
          "Declare each event as a named tuple: `defineEmits<{ change: [value: number] }>()`.",
      });
    };
    if (emits || events) {
      invalid(call, "`defineEmits` is called twice: a component declares its events once.");
      return;
    }
    if (call.arguments.length) {
      invalid(
        call.arguments[0]!,
        "`defineEmits` takes no arguments: its events are its type argument's members, which every target reads from the type.",
      );
      return;
    }
    const params = call.typeArguments?.params ?? [];
    if (params.length !== 1) {
      invalid(
        call,
        "`defineEmits` takes one type argument: the events, each a named tuple of its payload.",
      );
      return;
    }
    const type = params[0]!;
    const members = eventMembers(type);
    if (!members) {
      invalid(
        type,
        "`defineEmits`'s type argument is an object type literal, or a local `interface` or `type` of one, whose members are the events.",
      );
      return;
    }
    const declarations: EventDeclaration[] = [];
    let valid = true;
    for (const member of members) {
      if (member.type === "TSCallSignatureDeclaration") {
        invalid(
          member,
          "The call-signature form of `defineEmits` is Vue's: unframework declares each event as a property whose type is a named tuple.",
        );
        valid = false;
        continue;
      }
      if (member.type !== "TSPropertySignature" || member.computed || member.optional) {
        invalid(
          member,
          "An event is a property whose type is a named tuple: `change: [value: number]`.",
        );
        valid = false;
        continue;
      }
      const key = member.key;
      const name =
        key.type === "Identifier"
          ? key.name
          : key.type === "Literal" && typeof key.value === "string"
            ? key.value
            : undefined;
      const tuple = member.typeAnnotation?.typeAnnotation;
      if (name === undefined || tuple?.type !== "TSTupleType") {
        invalid(
          member,
          "An event is a property whose type is a named tuple: `change: [value: number]`.",
        );
        valid = false;
        continue;
      }
      const parameters = [];
      const labels = new Set<string>();
      for (const element of tuple.elementTypes) {
        if (
          element.type !== "TSNamedTupleMember" ||
          element.elementType.type === "TSRestType" ||
          element.elementType.type === "TSOptionalType"
        ) {
          invalid(
            element,
            "Each member of an event's payload is named, and none is a rest: `[value: number]`. Every target declares a parameter for each.",
          );
          valid = false;
          continue;
        }
        const label = element.label.name;
        if (labels.has(label)) {
          invalid(
            element.label,
            `\`${label}\` names two members of \`${name}\`'s payload: every target declares a parameter for each, by its name.`,
            "Name each member once.",
          );
          valid = false;
        }
        labels.add(label);
        if (!payloadType(name, element)) valid = false;
        parameters.push(
          createEventParameter(
            label,
            typeText(element.elementType),
            span(element),
            element.optional,
          ),
        );
        nullable.set(
          parameters.at(-1)!,
          Boolean(element.optional) ||
            mayBeNullish(context.types.kindsOf(element.elementType as AST.TSType)),
        );
      }
      const end = member.typeAnnotation!.end;
      declarations.push(createEventDeclaration(name, parameters, { start: member.start, end }));
      named.push({ name, key });
    }
    if (!valid) return;
    events = new Map(
      declarations.map((event) => [
        event.name,
        {
          required: event.parameters.filter((parameter) => !parameter.optional).length,
          total: event.parameters.length,
          nullable: event.parameters.map((parameter) => nullable.get(parameter) ?? true),
        },
      ]),
    );
    emits = createEmits(binding.id, typeText(type), declarations, span(statement));
    emitBinding = id;
  }

  /**
   * `const slots = defineSlots<{ default?(): Element; item?(props: { item: Item }): Element }>()`
   * (ADR-0054): one type argument, a type literal or a local type of one, whose members are the
   * slots, each optional, with at most one parameter, its props (UF2029).
   */
  function defineSlots(
    statement: AST.VariableDeclaration,
    id: AST.BindingIdentifier,
    call: AST.CallExpression,
  ): void {
    const binding = declare(id, "slots");
    const invalid = (at: { start: number; end: number }, message: string, help?: string) => {
      reporter.report("UF2029", at, message, {
        help:
          help ??
          "Declare each slot as an optional method: `defineSlots<{ default?(): Element; item?(props: { item: Item }): Element }>()`.",
      });
    };
    if (slotsCall) {
      invalid(call, "`defineSlots` is called twice: a component declares its slots once.");
      return;
    }
    slotsCall = call;
    if (call.arguments.length) {
      invalid(
        call.arguments[0]!,
        "`defineSlots` takes no arguments: its slots are its type argument's members.",
      );
      return;
    }
    const params = call.typeArguments?.params ?? [];
    if (params.length !== 1) {
      invalid(call, "`defineSlots` takes one type argument: the slots, each an optional method.");
      return;
    }
    const type = params[0]!;
    const members = eventMembers(type);
    if (!members) {
      invalid(
        type,
        "`defineSlots`'s type argument is an object type literal, or a local `interface` or `type` of one, whose members are the slots.",
      );
      return;
    }
    const declarations: SlotDeclaration[] = [];
    const seen = new Set<string>();
    for (const member of members) {
      const shape = slotShape(member);
      if (!shape) {
        invalid(
          member,
          "A slot is an optional method, `title?(): Element`, or `item?(props: { item: Item }): Element` for one with props.",
        );
        continue;
      }
      const { name, key, optional, parameters } = shape;
      if (!optional) {
        invalid(
          key,
          `The slot \`${name}\` is required: every slot is optional, since a parent may leave it empty and the fallback renders.`,
          `Write \`${name}?(…)\`.`,
        );
      }
      if (seen.has(name)) {
        invalid(key, `\`${name}\` is declared twice: a component declares each slot once.`);
      }
      seen.add(name);
      slotKeys.push({ name, key });
      if (name !== "default" && !/^[a-z][A-Za-z0-9]*$/.test(name)) {
        invalid(
          key,
          `\`${name}\` is not camelCase in ASCII letters and digits: every target spells a slot's name in an identifier or a prop.`,
          "Name the slot in camelCase: `title`, `itemLabel`.",
        );
      }
      if (parameters.length > 1) {
        invalid(
          parameters[1]!,
          `The slot \`${name}\` takes ${parameters.length} parameters: a slot takes one, the object of its props.`,
        );
        continue;
      }
      const [parameter] = parameters;
      let props: TypeText | undefined;
      if (parameter) {
        const annotation =
          parameter.type === "Identifier" ? parameter.typeAnnotation?.typeAnnotation : undefined;
        if (!annotation || parameter.type !== "Identifier" || parameter.optional) {
          invalid(
            parameter,
            `The slot \`${name}\`'s parameter is its props, a named parameter with their type: \`props: { item: Item }\`.`,
          );
          continue;
        }
        props = typeText(annotation);
      }
      declarations.push(
        createSlotDeclaration(name, optional, { start: member.start, end: member.end }, props),
      );
    }
    // Kept even where a slot is reported: the template still renders and tests the others, and
    // the component, which has an error, is never emitted.
    slots = createSlots(binding.id, typeText(type), declarations, span(statement));
  }

  /** What a slot member declares: its name, its key, whether it is optional, its parameters. */
  function slotShape(member: AST.TSSignature):
    | {
        name: string;
        key: AST.PropertyKey;
        optional: boolean;
        parameters: readonly AST.ParamPattern[];
      }
    | undefined {
    if (
      (member.type !== "TSMethodSignature" && member.type !== "TSPropertySignature") ||
      member.computed
    ) {
      return undefined;
    }
    const { key } = member;
    const name =
      key.type === "Identifier"
        ? key.name
        : key.type === "Literal" && typeof key.value === "string"
          ? key.value
          : undefined;
    if (name === undefined) return undefined;
    if (member.type === "TSMethodSignature") {
      if (member.kind !== "method" || member.typeParameters) return undefined;
      return { name, key, optional: member.optional, parameters: member.params };
    }
    const fn = member.typeAnnotation?.typeAnnotation;
    if (fn?.type !== "TSFunctionType" || fn.typeParameters) return undefined;
    return { name, key, optional: member.optional, parameters: fn.params };
  }

  /** What else a slot's name names: a prop, or an event's callback (`onClose`). */
  function slotNameTaken(name: string): string | undefined {
    if (context.props.byName.has(name)) return `the prop \`${name}\``;
    if (models.has(name)) return `the model \`${name}\``;
    const event = /^on[A-Z]/.test(name)
      ? `${name.charAt(2).toLowerCase()}${name.slice(3)}`
      : undefined;
    if (event !== undefined && events?.has(event)) return `the event \`${event}\`'s callback`;
    return undefined;
  }

  /**
   * `defineExpose({ focus, clear })` (ADR-0054): one object literal of the component's local
   * functions, in shorthand (UF2030). Its names are read once every binding is declared.
   */
  function defineExpose(call: AST.CallExpression): void {
    if (exposeCall) {
      reporter.report(
        "UF2030",
        call,
        "`defineExpose` is called twice: a component exposes its functions once.",
        { help: "Expose every function in one call: `defineExpose({ focus, clear })`." },
      );
      return;
    }
    exposeCall = call;
  }

  /** Checks `defineExpose`'s object, once every binding is declared (UF2030). */
  function checkExpose(call: AST.CallExpression): void {
    const invalid = (at: { start: number; end: number }, message: string) => {
      reporter.report("UF2030", at, message, {
        help: "Expose the component's local functions by name: `defineExpose({ focus, clear })`.",
      });
    };
    const [object, ...extra] = call.arguments;
    if (extra.length || call.typeArguments) {
      invalid(call, "`defineExpose` takes one argument, an object literal, and no type arguments.");
      return;
    }
    if (object?.type !== "ObjectExpression" || !object.properties.length) {
      invalid(
        object ?? call,
        "`defineExpose` takes an object literal of the component's local functions.",
      );
      return;
    }
    const functions: string[] = [];
    let valid = true;
    for (const property of object.properties) {
      const value =
        property.type === "Property" &&
        property.shorthand &&
        property.kind === "init" &&
        property.value.type === "Identifier"
          ? property.value
          : undefined;
      const binding = value ? setupBinding(value) : undefined;
      if (!value || binding?.kind !== "localFn") {
        invalid(
          property,
          value
            ? `\`${value.name}\` is not a local function: a component exposes the functions its setup declares.`
            : "A member of `defineExpose`'s object is a local function's name, in shorthand: `{ focus }`.",
        );
        valid = false;
        continue;
      }
      if (functions.includes(binding.id)) {
        invalid(property, `\`${binding.name}\` is exposed twice.`);
        valid = false;
        continue;
      }
      functions.push(binding.id);
    }
    if (valid) exposes = createExposes(functions, span(call));
  }

  /** The setup binding an identifier in the setup's own statements reads, if any. */
  function setupBinding(identifier: AST.IdentifierReference): SetupBinding | undefined {
    const resolution = context.scopes.resolve(identifier);
    return resolution.kind === "variable" && resolution.scope === context.component
      ? bindings.get(resolution.declaration)
      : undefined;
  }

  /** `defineOptions({ inheritAttrs: false })` (ADR-0054): that one static option (UF2031). */
  function defineOptions(call: AST.CallExpression): void {
    const invalid = (at: { start: number; end: number }, message: string) => {
      reporter.report("UF2031", at, message, {
        help: "Write `defineOptions({ inheritAttrs: false })`, or leave it out: fallthrough is on by default.",
      });
    };
    if (optionsCall) {
      invalid(call, "`defineOptions` is called twice: a component sets its options once.");
      return;
    }
    optionsCall = call;
    const [object, ...extra] = call.arguments;
    if (extra.length || call.typeArguments || object?.type !== "ObjectExpression") {
      invalid(call, "`defineOptions` takes one object literal: `{ inheritAttrs: false }`.");
      return;
    }
    const [only, ...more] = object.properties;
    const option = inheritAttrsOption(object);
    const inherit = option === only ? option : undefined;
    if (!inherit || more.length) {
      invalid(
        more[0] ?? only ?? object,
        "`defineOptions` takes one option, `inheritAttrs: false`: the other options are Vue's, which the other targets have no counterpart for.",
      );
      return;
    }
    if (inherit.value.type !== "Literal" || inherit.value.value !== false) {
      invalid(
        inherit.value,
        "`inheritAttrs` is `false` as a literal: fallthrough is on by default, and a value the compiler cannot read cannot decide it.",
      );
      return;
    }
    inheritAttrs = false;
  }

  /**
   * `const value = defineModel<string>("value", { default: "" })` (ADR-0054): a name, a string
   * literal in camelCase that no prop or other model takes, and static options, `default` and
   * `required` (UF2028). A nameless model gets the safe fix to `"value"`.
   */
  function defineModel(
    statement: AST.VariableDeclaration,
    id: AST.BindingIdentifier,
    call: AST.CallExpression,
  ): void {
    const invalid = (at: { start: number; end: number }, message: string, fixes?: Fix[]) => {
      reporter.report("UF2028", at, message, {
        help: 'Name the model and give it static options: `defineModel<string>("value", { default: "" })`.',
        ...(fixes ? { fixes } : {}),
      });
    };
    const binding = declare(id, "model");
    const [name, options, ...extra] = call.arguments;
    const spread = call.arguments.find((argument) => argument.type === "SpreadElement");
    const params = call.typeArguments?.params ?? [];
    if (spread || extra.length || params.length > 1) {
      invalid(
        spread ?? extra[0] ?? call.typeArguments!,
        "`defineModel` takes a name and its options, none spread, and one type argument at most.",
      );
      return;
    }
    if (!name || name.type === "ObjectExpression") {
      const at = name ? name.start : call.end - 1;
      invalid(
        call,
        "`defineModel` is called without a name: every target names a model's prop after it (`value`, React's `onValueChange`), so the name is written out.",
        [
          {
            title: 'Name the model `"value"`',
            confidence: "safe",
            edits: [{ span: { start: at, end: at }, text: name ? '"value", ' : '"value"' }],
          },
        ],
      );
      return;
    }
    if (name.type !== "Literal" || typeof name.value !== "string") {
      invalid(name, 'A model\'s name is a string literal: `defineModel<string>("value")`.');
      return;
    }
    const model = name.value;
    if (!/^[a-z][A-Za-z0-9]*$/.test(model)) {
      invalid(
        name,
        `\`"${model}"\` is not camelCase in ASCII letters and digits: every target spells a model's name in a prop.`,
      );
      return;
    }
    if (models.has(model)) {
      invalid(
        name,
        `The model \`${model}\` is declared twice: a component declares each model once.`,
      );
      return;
    }
    models.set(model, name);
    if (context.props.byName.has(model)) {
      invalid(
        name,
        `The model \`${model}\` is named like a prop: every target passes a model as a prop of its name, so the two would collide.`,
      );
      return;
    }
    const checked = options ? modelOptions(options as AST.Expression) : {};
    if (!checked) return;
    const [type] = params;
    binding.kinds = type
      ? checked.default || checked.required
        ? context.types.kindsOf(type)
        : union(context.types.kindsOf(type), UNDEFINED)
      : UNKNOWN;
    declared.push({ kind: "model", statement, call, binding, name: model, options: checked });
  }

  /** `defineModel`'s options: an object literal of a static `default` and `required` (UF2028). */
  function modelOptions(options: AST.Expression): ModelOptions | undefined {
    const invalid = (at: { start: number; end: number }, message: string) => {
      reporter.report("UF2028", at, message, {
        help: 'Write the options as a static object: `{ default: "" }` or `{ required: true }`.',
      });
      return undefined;
    };
    if (options.type !== "ObjectExpression") {
      return invalid(options, "`defineModel`'s options are an object literal.");
    }
    const checked: ModelOptions = {};
    const seen = new Set<string>();
    for (const property of options.properties) {
      const key =
        property.type === "Property" && !property.computed && property.kind === "init"
          ? property.key.type === "Identifier"
            ? property.key.name
            : property.key.type === "Literal" && typeof property.key.value === "string"
              ? property.key.value
              : undefined
          : undefined;
      if (
        property.type !== "Property" ||
        property.method ||
        property.shorthand ||
        (key !== "default" && key !== "required") ||
        seen.has(key)
      ) {
        return invalid(
          property,
          "`defineModel` takes two options, each once: a static `default`, and `required`. The others are Vue's, which the other targets have no counterpart for.",
        );
      }
      seen.add(key);
      const value = property.value as AST.Expression;
      if (key === "required") {
        if (value.type !== "Literal" || typeof value.value !== "boolean") {
          return invalid(value, "`required` is `true` or `false`, as a literal.");
        }
        if (value.value) checked.required = true;
        continue;
      }
      if (!isStatic(value)) {
        return invalid(
          value,
          "A model's default must be a static value, as a prop's is: Vue hoists defaults out of the component, and Angular reads them before any input is set.",
        );
      }
      checked.default = value;
    }
    return checked;
  }

  /** The injection key a call names: an identifier that reads a key of the module (UF2032). */
  function keyOf(
    call: AST.CallExpression,
    node: AST.Expression | AST.SpreadElement | undefined,
  ): InjectionKeyInfo | undefined {
    const api = (call.callee as AST.IdentifierReference).name;
    if (node?.type === "Identifier") {
      const resolution = context.scopes.resolve(node);
      const declaration =
        resolution.kind === "import" || resolution.kind === "variable"
          ? resolution.declaration
          : undefined;
      const key = declaration ? context.keys.get(declaration) : undefined;
      if (key) return key;
    }
    reporter.report(
      "UF2032",
      node ?? call,
      `\`${api}\` takes an injection key: an exported \`InjectionKey\` of this module, or one imported from another \`.uf.tsx\` module.`,
      {
        help: 'Declare the key in the module that provides it: `export const ThemeKey: InjectionKey<Theme> = Symbol("theme");`.',
      },
    );
    return undefined;
  }

  /**
   * `const theme = inject(ThemeKey, fallback)` (ADR-0054): a key, and the value to read where no
   * ancestor provides it; before any `provide` of the same key, which would answer it first on
   * Angular (UF2032).
   */
  function inject(
    statement: AST.VariableDeclaration,
    id: AST.BindingIdentifier,
    call: AST.CallExpression,
  ): void {
    const [node, fallback, ...extra] = call.arguments;
    const binding = declare(id, "context");
    if (call.typeArguments || extra.length || fallback?.type === "SpreadElement") {
      reporter.report(
        "UF2032",
        call.typeArguments ?? extra[0] ?? fallback!,
        "`inject` takes a key and a fallback, none spread, and no type arguments: the key types it.",
        { help: "Write `inject(ThemeKey)` or `inject(ThemeKey, fallback)`." },
      );
      return;
    }
    const key = keyOf(call, node);
    if (!key) return;
    const first = provided.get(key.name);
    if (first) {
      reporter.report(
        "UF2032",
        call,
        `\`${key.name}\` is injected after the component provides it: a component that provides a key and injects it reads its parent's value, so \`inject\` comes first.`,
        {
          help: "Move the `inject` above the `provide`.",
          related: [{ span: span(first), message: "Provided here" }],
        },
      );
      return;
    }
    const holdsRef = key.ref !== undefined;
    if (holdsRef && !fallback) {
      reporter.report(
        "UF2032",
        call,
        `\`${key.name}\` holds a ref, which code reads as \`${id.name}.value\`: \`inject\` takes a fallback ref, read where no ancestor provides one.`,
        { help: `Pass a ref of the setup: \`inject(${key.name}, fallback)\`.` },
      );
      return;
    }
    injected.set(key.name, call);
    const value = valueType(key);
    const kinds = value ? context.types.kindsOf(value) : UNKNOWN;
    binding.kinds = fallback ? kinds : union(kinds, UNDEFINED);
    if (holdsRef) binding.ref = true;
    declared.push({ kind: "inject", statement, call, binding, key });
  }

  /** `provide(ThemeKey, theme)` (ADR-0054): a key, once, and the value its descendants read. */
  function provide(statement: AST.Statement, call: AST.CallExpression): void {
    const [node, value, ...extra] = call.arguments;
    if (call.typeArguments || extra.length || !value || value.type === "SpreadElement") {
      reporter.report(
        "UF2032",
        call.typeArguments ?? extra[0] ?? value ?? call,
        "`provide` takes a key and a value, none spread, and no type arguments: the key types it.",
        { help: "Write `provide(ThemeKey, theme)`." },
      );
      return;
    }
    const key = keyOf(call, node);
    if (!key) return;
    const first = provided.get(key.name);
    if (first) {
      reporter.report(
        "UF2032",
        call,
        `\`${key.name}\` is provided twice: a component provides each key once.`,
        {
          help: "Provide one value for the key.",
          related: [{ span: span(first), message: "First provided here" }],
        },
      );
      return;
    }
    provided.set(key.name, call);
    declared.push({ kind: "provide", statement, call, key });
  }

  /**
   * Checks a payload member's type (UF2009): one of the types every target's props declare, as
   * a prop's type is (Vue declares an event's payload as it declares props), through the local
   * types it names. Returns whether it is.
   */
  function payloadType(event: string, element: AST.TSNamedTupleMember): boolean {
    const probe = new Reporter(reporter.file);
    const types = { table: context.types, reported: new Set<string>() } as unknown as ModuleTypes;
    const type = element.elementType as AST.TSType;
    checkType(type, types, probe);
    for (const name of closure(type, context.types)) {
      const declaration = context.types.declaration(name)!;
      const { node } = declaration;
      if (node.typeParameters) {
        probe.unsupported(node.typeParameters, `\`${name}\` is generic.`);
      } else if (node.type === "TSInterfaceDeclaration") {
        if (node.extends.length) probe.unsupported(node, `\`${name}\` extends another type.`);
        checkMembers(node.body.body, types, probe);
      } else {
        checkType(node.typeAnnotation, types, probe);
      }
    }
    const [problem] = probe.diagnostics;
    if (!problem) return true;
    reporter.report(
      "UF2009",
      type,
      `\`${element.label.name}\` of \`${event}\`'s payload has a type outside the types every target's props declare (Vue declares an event's payload as it declares props): ${problem.message}`,
      {
        help: "Give the member a type props can have: strings, numbers, booleans, literals, `null`, `undefined`, arrays and local object types of them.",
      },
    );
    return false;
  }

  /**
   * Checks the events' names (UF2008, ADR-0047), once every binding is declared: camelCase ASCII,
   * which every target spells as a prop or an output (`onChange`, Svelte's `onchange`, an Angular
   * output); not starting as an event prop does (angular-eslint's `no-output-on-prefix`); apart
   * from each other once lower-cased (Svelte); apart from the props (public on every target, and
   * Angular declares a member of each), and from the props Svelte's spelling would take. A setup
   * binding may share an event's name (`function save() { emit("save"); }`): it is private to
   * the component, and Angular's output, which declares a member of each, aliases its output
   * (ADR-0047). The safe fix renames an event whose canonical spelling is free: the declaration
   * and every emit.
   */
  function checkEventNames(): void {
    if (!emitBinding) return;
    const taken = new Map<string, string>();
    for (const prop of context.props.byName.keys()) taken.set(prop, `the prop \`${prop}\``);
    const lower = new Map<string, string>();
    for (const { name } of named) {
      lower.set(name.toLowerCase(), lower.get(name.toLowerCase()) ?? name);
    }
    const problem = (name: string, own: string): string | undefined => {
      if (!/^[a-z][A-Za-z0-9]*$/.test(name)) {
        return `\`${name}\` is not camelCase in ASCII letters and digits, starting with a lower-case letter: every target spells an event's name in an identifier, a prop (\`onChange\`, Svelte's \`onchange\`) or an Angular output.`;
      }
      if (/^on([^a-z]|$)/.test(name)) {
        return `\`${name}\` is named as an event prop is: a consumer would listen to it as \`on${name.charAt(0).toUpperCase()}${name.slice(1)}\`, and angular-eslint's \`no-output-on-prefix\` rejects it.`;
      }
      const reserved = reservedEventName(name);
      if (reserved) {
        return `\`${name}\` cannot name an event, which Angular's output declares as a member its template statements read by name: ${reserved}`;
      }
      const twin = lower.get(name.toLowerCase());
      if (twin !== undefined && twin !== own) {
        return `\`${name}\` and \`${twin}\` differ only in case: Svelte lower-cases an event's prop (\`on${name.toLowerCase()}\`).`;
      }
      const owner = taken.get(name);
      if (owner) {
        return `\`${name}\` is also ${owner}'s name: Angular's output declares a member of each.`;
      }
      const svelte = `on${name.toLowerCase()}`;
      if (context.props.byName.has(svelte)) {
        return `\`${name}\`'s prop on Svelte, \`${svelte}\`, is a prop's name already.`;
      }
      return undefined;
    };
    const seen = new Set<string>();
    for (const { name, key } of named) {
      const repeated = seen.has(name);
      seen.add(name);
      const found = repeated
        ? `\`${name}\` is declared twice: a component declares each event once.`
        : problem(name, name);
      if (!found) continue;
      const renamed = canonicalEventName(name);
      const fix =
        !repeated &&
        renamed !== undefined &&
        renamed !== name &&
        !named.some((event) => event.name === renamed) &&
        problem(renamed, name) === undefined
          ? renameEvent(name, renamed, key)
          : undefined;
      reporter.report("UF2008", key, found, {
        help: "Name the event in camelCase, as its own word: `change`, `levelChange`, `select`.",
        ...(fix ? { fixes: [fix] } : {}),
      });
    }
  }

  /** The safe fix of UF2008: the event's new name in its declaration and in every emit of it. */
  function renameEvent(name: string, renamed: string, key: AST.PropertyKey): Fix {
    const edits: Fix["edits"] = [{ span: span(key), text: renamed }];
    visit(context.component.body, (node) => {
      if (node.type !== "CallExpression" || node.callee.type !== "Identifier") return;
      const resolution = context.scopes.resolve(node.callee);
      if (resolution.kind !== "variable" || resolution.declaration !== emitBinding) return;
      const [first] = node.arguments;
      if (first?.type === "Literal" && first.value === name) {
        edits.push({ span: { start: first.start + 1, end: first.end - 1 }, text: renamed });
      } else if (
        first?.type === "TemplateLiteral" &&
        !first.expressions.length &&
        first.quasis.map((quasi) => quasi.value.cooked ?? "").join("") === name
      ) {
        edits.push({ span: { start: first.start + 1, end: first.end - 1 }, text: renamed });
      }
    });
    return { title: `Rename the event \`${name}\` to \`${renamed}\``, confidence: "safe", edits };
  }

  /** The members of `defineEmits`'s type argument: a type literal's, or a local type's. */
  function eventMembers(type: AST.TSType): readonly AST.TSSignature[] | undefined {
    if (type.type === "TSTypeLiteral") return type.members;
    if (
      type.type !== "TSTypeReference" ||
      type.typeName.type !== "Identifier" ||
      type.typeArguments
    ) {
      return undefined;
    }
    const declaration = context.types.declaration(type.typeName.name);
    if (!declaration) return undefined;
    const { node } = declaration;
    if (node.type === "TSInterfaceDeclaration")
      return node.extends.length ? undefined : node.body.body;
    return node.typeAnnotation.type === "TSTypeLiteral" ? node.typeAnnotation.members : undefined;
  }

  /** A type as written. */
  function typeText(type: AST.TSType): TypeText {
    return createTypeText(source.slice(type.start, type.end), span(type));
  }

  /** A local function that returns JSX: a helper, outside every template (UF3012). */
  function helper(fn: SetupFunction, id: AST.BindingIdentifier): boolean {
    const { body } = fn;
    const returned =
      body?.type === "BlockStatement"
        ? body.body.filter((item) => item.type !== "EmptyStatement").at(-1)
        : undefined;
    const jsx =
      body && body.type !== "BlockStatement"
        ? holdsJsx(body)
        : returned?.type === "ReturnStatement" && holdsJsx(returned.argument);
    if (!jsx) return false;
    reporter.report(
      "UF3012",
      id,
      `${id.name} is a helper that returns JSX, and JSX can only be in a component's template: the tree the component returns, and its slot functions.`,
      {
        help: "Inline the JSX where it is used, or extract a component: an exported function with a PascalCase name.",
      },
    );
    return true;
  }

  /** A `return` before the body's last statement (UF2012). */
  function conditionalReturn(statement: AST.ReturnStatement): void {
    reporter.report(
      "UF2012",
      statement,
      "The component's body returns before its last statement: the setup runs once, and the template its last statement returns decides what renders.",
      {
        help: "Move the condition into the JSX: `{message && <p>{message}</p>}`, or `c ? <A /> : <B />`.",
      },
    );
  }

  /**
   * Any other statement: one that returns early (UF2012), one that calls an authoring API inside
   * a condition, a loop or a block (UF2005), or code the setup would run once on every target,
   * where it belongs in `onMounted` or a function (UF1002).
   */
  function other(statement: AST.Statement): void {
    const returns = returnsIn(statement);
    if (returns.length) {
      for (const item of returns) conditionalReturn(item);
      return;
    }
    const apis = apisIn(statement, context);
    if (apis.length) {
      for (const { identifier, called } of apis) {
        reporter.report(
          "UF2005",
          identifier,
          called
            ? `\`${identifier.name}\` is called inside other code: the macros and reactive APIs are called once, at the top level of the component's body, where every target runs the setup once.`
            : `\`${identifier.name}\` is used as a value: the macros and reactive APIs are only called, at the top level of the component's body.`,
          {
            help: "Move the call to the top level of the component's body, as a statement or a `const`'s value.",
          },
        );
      }
      return;
    }
    reporter.unsupported(
      statement,
      statement.type === "TSInterfaceDeclaration" || statement.type === "TSTypeAliasDeclaration"
        ? "Types declared in a component's body are not supported: declare them at the module's top level."
        : "Statements other than declarations are not supported in the setup: the setup runs once, and declares what the component holds.",
      {
        help:
          statement.type === "TSInterfaceDeclaration" || statement.type === "TSTypeAliasDeclaration"
            ? "Move the type to the module's top level."
            : "Run it from `onMounted`, a handler or a local function.",
      },
    );
  }

  checkEventNames();
  checkSlotNames();
  checkModelNames();

  /**
   * Checks the models' names against the events (UF2028), once every event is declared: React,
   * Solid and Qwik write a model's change as a callback prop (`onValueChange`), which an event
   * named `valueChange` would also be.
   */
  function checkModelNames(): void {
    for (const [name, node] of models) {
      const event = `${name}Change`;
      if (!events?.has(event)) continue;
      reporter.report(
        "UF2028",
        node,
        `The model \`${name}\` and the event \`${event}\` collide: React, Solid and Qwik write a model's change as the callback \`on${name.charAt(0).toUpperCase()}${name.slice(1)}Change\`, which is also the event's.`,
        { help: "Rename the model or the event." },
      );
    }
  }
  if (exposeCall) checkExpose(exposeCall);

  /**
   * Checks the slots' names against the props and the events' callbacks (UF2029), once every
   * event is declared: React, Solid, Qwik and Astro pass a slot as a prop.
   */
  function checkSlotNames(): void {
    for (const { name, key } of slotKeys) {
      const taken = slotNameTaken(name);
      if (!taken) continue;
      reporter.report(
        "UF2029",
        key,
        `The slot \`${name}\` is named like ${taken}: React, Solid, Qwik and Astro pass a slot as a prop, so the two would collide.`,
        { help: "Rename the slot." },
      );
    }
  }

  const scope: SetupScope = {
    bindings,
    authoring: context.authoring,
    get events() {
      return events;
    },
    eventParameters,
  };
  findEventParameters(context, bindings, eventParameters);

  let lowered = false;
  const sources = new Map<SetupItem, ItemSource>();
  return {
    scope,
    sources,
    get bindings() {
      return [...bindings.values()].map((binding) =>
        createBinding(binding.name, binding.kind, {
          start: binding.declaration.start,
          end: binding.declaration.start + binding.name.length,
        }),
      );
    },
    items,
    get emits() {
      return emits;
    },
    get slots() {
      return slots;
    },
    get exposes() {
      return exposes;
    },
    get inheritAttrs() {
      return inheritAttrs;
    },
    lower(render) {
      if (lowered) return;
      lowered = true;
      for (const item of declared) {
        const ir = lowerItem(item, render);
        if (!ir) continue;
        items.push(ir);
        sources.set(ir, sourceOf(item));
      }
      // The two passes report apart: in source order, as every walk does.
      reporter.diagnostics.push(
        ...reporter.diagnostics.splice(mark).toSorted((a, b) => a.span.start - b.span.start),
      );
    },
    finish(render) {
      for (const binding of bindings.values()) {
        if (binding.kind !== "templateRef" || render.attached.has(binding.declaration)) continue;
        reporter.report(
          "UF3027",
          {
            start: binding.declaration.start,
            end: binding.declaration.start + binding.name.length,
          },
          `\`${binding.name}\` is never attached: a template ref holds the element whose \`ref\` takes it.`,
          { help: `Write \`ref={${binding.name}}\` on its element, or remove the template ref.` },
        );
      }
    },
  };
}

/**
 * What the rules judged once everything is lowered read of an item's source (`./rules.ts`): the
 * statement, and the call, callback and options of a watcher, an effect or a hook.
 */
export interface ItemSource {
  readonly statement: AST.Statement;
  readonly call?: AST.CallExpression;
  readonly callback?: AST.ArrowFunctionExpression;
  readonly options?: AST.ObjectExpression;
}

/** The source of a declared item, for the rules (`ItemSource`). */
function sourceOf(item: Declared): ItemSource {
  if (item.kind !== "watch" && item.kind !== "watchEffect" && item.kind !== "lifecycle") {
    return { statement: item.statement };
  }
  const position = item.kind === "watch" ? 1 : 0;
  const fn = item.call.arguments[position];
  const options = item.call.arguments[position + 1];
  return {
    statement: item.statement,
    call: item.call,
    ...(fn?.type === "ArrowFunctionExpression" ? { callback: fn } : {}),
    ...(options?.type === "ObjectExpression" ? { options } : {}),
  };
}

/**
 * Lowers a declared item (pass two), walking its code in the context it runs in, and fills in
 * the kinds of the binding it declares.
 */
function lowerItem(item: Declared, render: RenderContext): SetupItem | undefined {
  const { source } = render;
  const at = span(item.statement);
  const typeText = (type: AST.TSType | undefined): TypeText | undefined =>
    type ? createTypeText(source.slice(type.start, type.end), span(type)) : undefined;
  switch (item.kind) {
    case "state": {
      const [type] = item.call.typeArguments?.params ?? [];
      const [initial] = item.call.arguments as AST.Expression[];
      const checked = initial ? checkCode(initial, render) : undefined;
      if (!type && checked) item.binding.kinds = checked.widened;
      if (has(item.binding.kinds, "function")) {
        render.reporter.report(
          "UF2021",
          item.call,
          `\`${item.binding.name}\` is state that may hold a function: React's setter calls a function it is given as an updater, and \`useState\` one as its initializer, so React's output would not store it.`,
          {
            help: 'Keep the function in a local function, and in state what decides it: `const mode = ref<"list" | "grid">("list")`.',
          },
        );
      }
      return createStateItem(item.binding.id, at, checked?.code, typeText(type));
    }
    case "derived": {
      const [type] = item.call.typeArguments?.params ?? [];
      const getter = item.call.arguments[0] as AST.ArrowFunctionExpression;
      const lowered = lowerFunction(getter, render, { role: "getter" });
      if (!type) item.binding.kinds = lowered.returns;
      return createDerivedItem(item.binding.id, lowered.function, at, typeText(type));
    }
    case "templateRef": {
      const [type] = item.call.typeArguments?.params ?? [];
      return createTemplateRefItem(item.binding.id, at, typeText(type));
    }
    case "id":
      return createIdItem(item.binding.id, at);
    case "const": {
      const { declarator } = item;
      const value = declarator.init!;
      const checked = checkCode(value, render);
      const annotation = (declarator.id as AST.BindingIdentifier).typeAnnotation?.typeAnnotation;
      // A `const` keeps a literal's kinds, and widens an object's or an array's (ADR-0046).
      if (!annotation) item.binding.kinds = checked.literal;
      return createConstItem(item.binding.id, checked.code, at, typeText(annotation));
    }
    case "let": {
      const { declarator } = item;
      const checked = declarator.init ? checkCode(declarator.init, render) : undefined;
      const annotation = (declarator.id as AST.BindingIdentifier).typeAnnotation?.typeAnnotation;
      if (!annotation) item.binding.kinds = checked ? checked.widened : UNDEFINED;
      return createVariableItem(item.binding.id, at, checked?.code, typeText(annotation));
    }
    case "function": {
      const event = render.setup.eventParameters.get(item.fn);
      const lowered = lowerFunction(item.fn, render, {
        role: "function",
        item: true,
        ...(event ? { event } : {}),
      });
      if (!item.fn.returnType) item.binding.kinds = lowered.returns;
      if (lowered.nondeterministic) item.binding.nondeterministic = lowered.nondeterministic;
      return createFunctionItem(item.binding.id, item.form, lowered.function, at);
    }
    case "watch":
      return lowerWatch(item.statement, item.call, render);
    case "watchEffect": {
      const [effect, options, ...extra] = item.call.arguments;
      if (extra.length) {
        render.reporter.unsupported(extra[0]!, "`watchEffect` takes an effect and its options.");
      }
      if (!callback(effect, "watchEffect", item.call, render) || extra.length) return undefined;
      const flags = watchOptions(options, "watchEffect", item.call, render);
      const fn = effect as AST.ArrowFunctionExpression;
      const lowered = lowerFunction(fn, render, { role: "watchEffect" });
      cleanups(fn, 0, false, render);
      if (!flags) return undefined;
      return createWatchEffectItem(lowered.function, at);
    }
    case "model": {
      const [type] = item.call.typeArguments?.params ?? [];
      const value = item.options.default;
      return createModelItem(item.binding.id, item.name, at, {
        ...(type ? { type: typeText(type)! } : {}),
        ...(value
          ? { default: createExpression(source.slice(value.start, value.end), span(value)) }
          : {}),
        ...(item.options.required ? { required: true } : {}),
      });
    }
    case "inject": {
      const fallback = item.call.arguments[1] as AST.Expression | undefined;
      const code = fallback ? contextValue(fallback, item.key, render) : undefined;
      if (fallback && !code) return undefined;
      return createInjectItem(item.binding.id, item.key.name, at, code);
    }
    case "provide": {
      const code = contextValue(item.call.arguments[1] as AST.Expression, item.key, render);
      return code && createProvideItem(item.key.name, code, at);
    }
    case "lifecycle": {
      const [hook, ...extra] = item.call.arguments;
      const name = (item.call.callee as AST.IdentifierReference).name;
      if (extra.length) render.reporter.unsupported(extra[0]!, `\`${name}\` takes one function.`);
      if (!callback(hook, name, item.call, render)) return undefined;
      const lowered = lowerFunction(hook as AST.ArrowFunctionExpression, render, {
        role: "lifecycle",
      });
      return createLifecycleItem(item.hook, lowered.function, at);
    }
    default:
      return unreachable(item);
  }
}

/**
 * What `provide` gives a key, or what `inject` falls back to (ADR-0054): for a key of a ref, the
 * ref itself, a `state`, `derived` or `model` binding by its name, which stays reactive; for any
 * other key, code that runs as the setup does.
 */
function contextValue(
  node: AST.Expression,
  key: InjectionKeyInfo,
  render: RenderContext,
): Code | undefined {
  if (!key.ref) return checkCode(node, render).code;
  // A `ComputedRef` takes a `computed`, a `ModelRef` a model; a `Ref` any of them, whose types
  // each target's `Ref` accepts.
  const accepted = REF_BINDINGS[key.ref];
  const binding = node.type === "Identifier" ? setupBindingOf(node, render) : undefined;
  if (binding && (accepted as readonly string[]).includes(binding.kind)) {
    return createCode(binding.name, span(node), [createBindingReference(binding.id, span(node))]);
  }
  const what = { state: "a `ref`", derived: "a `computed`", model: "a model" };
  render.reporter.report(
    "UF2032",
    node,
    `\`${key.name}\` holds a \`${key.ref}\`, so it takes ${accepted
      .map((kind) => what[kind])
      .join(", ")
      .replace(/, ([^,]*)$/, " or $1")} by its name, which stays reactive where it is injected.`,
    { help: "Pass the ref itself: `provide(CountKey, count)`." },
  );
  return undefined;
}

/** The bindings a key of each kind of ref takes whole. */
const REF_BINDINGS: Readonly<Record<RefType, readonly ("state" | "derived" | "model")[]>> = {
  Ref: ["state", "derived", "model"],
  ComputedRef: ["derived"],
  ModelRef: ["model"],
};

/** The authoring types of a ref, which a key may hold: code reads its value (ADR-0054). */
const REF_TYPES: ReadonlySet<string> = new Set(["Ref", "ComputedRef", "ModelRef"]);

/**
 * The ref a key's value type is (`InjectionKey<Ref<number>>`), read from its AST: what it
 * provides stays reactive, and an injection reads it as `x.value`.
 */
export function refTypeOf(type: AST.TSType | undefined): RefType | undefined {
  return type?.type === "TSTypeReference" &&
    type.typeName.type === "Identifier" &&
    REF_TYPES.has(type.typeName.name) &&
    type.typeArguments?.params.length === 1
    ? (type.typeName.name as RefType)
    : undefined;
}

/**
 * The type of what reading a key's injection gives: a ref's value's, for a key of a ref. An
 * imported key's type is text, which the model does not read.
 */
function valueType(key: InjectionKeyInfo): AST.TSType | undefined {
  const { type } = key;
  if (typeof type === "string") return undefined;
  return key.ref ? (type as AST.TSTypeReference).typeArguments!.params[0] : type;
}

/** The parameters each API passes its callback, as the wrapper of UF2022's fix names them. */
const CALLBACK_PARAMETERS: Readonly<Record<string, readonly string[]>> = {
  watch: ["value", "previous", "onCleanup"],
  watchEffect: ["onCleanup"],
};

/**
 * Whether a watcher's, an effect's or a hook's callback is an arrow function written in place:
 * the targets write it into their own effect or hook. A local function passed by name
 * (`onMounted(start)`) is UF2022, whose safe fix wraps it (`() => start()`); any other value is
 * not supported (UF1002).
 */
function callback(
  node: AST.Argument | undefined,
  api: string,
  call: AST.CallExpression,
  render: RenderContext,
): boolean {
  if (node?.type === "ArrowFunctionExpression") return true;
  if (node?.type === "Identifier") {
    const binding = setupBindingOf(node, render);
    const fix = binding?.kind === "localFn" ? wrapFix(node, binding, api, render) : undefined;
    render.reporter.report(
      "UF2022",
      node,
      binding?.kind === "localFn"
        ? `\`${node.name}\` is passed to \`${api}\` by name: the targets write the callback into their own effect or hook (Angular's method, Qwik's task), which takes it written in place.`
        : `\`${node.name}\` is passed to \`${api}\` as its callback, which is a function written in place.`,
      {
        help: `Write the callback in place: \`${api}(() => { … })\`.`,
        ...(fix ? { fixes: [fix] } : {}),
      },
    );
    return false;
  }
  render.reporter.unsupported(
    node ?? call,
    `\`${api}\`'s callback is written in place, as an arrow function: \`${api}(() => { … })\`.`,
  );
  return false;
}

/**
 * UF2022's safe fix for a local function passed to an API by name: an arrow function that calls
 * it with what the API passes its callback, under names no binding takes.
 */
function wrapFix(
  node: AST.IdentifierReference,
  binding: SetupBinding,
  api: string,
  render: RenderContext,
): Fix | undefined {
  const fn = binding.function;
  if (!fn) return undefined;
  const passed = CALLBACK_PARAMETERS[api] ?? [];
  const rest = fn.params.some((parameter) => parameter.type === "RestElement");
  const count = rest ? passed.length : Math.min(passed.length, fn.params.length);
  const names = passed.slice(0, count).map((fallback, index) => {
    const own = fn.params[index];
    return own?.type === "Identifier" ? own.name : fallback;
  });
  const taken = (name: string) =>
    render.props.has(name) ||
    render.propsObject?.name === name ||
    [...render.setup.bindings.values()].some((other) => other.name === name) ||
    reservedParameterName(name) !== undefined;
  if (names.some(taken) || new Set(names).size !== names.length) return undefined;
  const list = names.join(", ");
  return {
    title: `Wrap \`${node.name}\` in an arrow function`,
    confidence: "safe",
    edits: [{ span: span(node), text: `(${list}) => ${node.name}(${list})` }],
  };
}

/**
 * Checks the uses of a callback's `onCleanup` parameter (ADR-0048): it is only called, directly in
 * the synchronous part of the callback: not after an `await`, not in a function inside it, not
 * passed on. An immediate watcher's is UF2013 (its first callback runs during the setup); any
 * other's is not supported (UF1002): Solid's `onCleanup` needs the effect that runs it.
 */
function cleanups(
  fn: SetupFunction,
  index: number,
  immediate: boolean,
  render: RenderContext,
  seen: Set<object> = new Set(),
): void {
  const parameter = fn.params[index];
  if (parameter?.type !== "Identifier" || !fn.body) return;
  const { scopes, reporter } = render;
  const awaited = firstAwait(fn.body);
  const visitAll = (node: unknown, parent: AST.Node | undefined, nested: boolean): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) visitAll(item, parent, nested);
      return;
    }
    const typed = node as AST.Node;
    if (typeof typed.type !== "string") return;
    if (typed.type === "Identifier") {
      const resolution = scopes.resolve(typed as AST.IdentifierReference);
      if (resolution.kind === "parameter" && resolution.declaration === parameter) {
        const called = parent?.type === "CallExpression" && parent.callee === typed;
        // Passed whole to a local function, it is that function's parameter's to judge.
        const callee =
          parent?.type === "CallExpression" && parent.callee.type === "Identifier"
            ? setupBindingOf(parent.callee, render)
            : undefined;
        const passed =
          !called &&
          callee?.kind === "localFn" &&
          callee.function !== undefined &&
          parent?.type === "CallExpression" &&
          parent.arguments.includes(typed as AST.Argument);
        const why = passed
          ? nested
            ? "is passed on in a function inside the callback, which runs later"
            : awaited !== undefined && typed.start > awaited
              ? "is passed on after an `await`"
              : undefined
          : !called
            ? "is used as a value"
            : nested
              ? "is called in a function inside the callback, which runs later"
              : awaited !== undefined && typed.start > awaited
                ? "is called after an `await`"
                : undefined;
        if (passed && !why && !seen.has(callee.function!)) {
          seen.add(callee.function!);
          const position = (parent as AST.CallExpression).arguments.indexOf(typed as AST.Argument);
          cleanups(callee.function!, position, immediate, render, seen);
        }
        if (why) {
          const message = `\`${typed.name}\` ${why}: a callback registers its cleanups as it runs, at once, where Solid's \`onCleanup\` finds the effect that runs them.`;
          const help = "Call it directly in the callback's body, before any `await`.";
          if (immediate) {
            reporter.report(
              "UF2013",
              typed,
              `${message} An immediate watcher's first callback runs during the setup, on the server too on Vue.`,
              { help },
            );
          } else {
            reporter.unsupported(typed, message, { help });
          }
        }
      }
      return;
    }
    const inner =
      nested ||
      typed.type === "ArrowFunctionExpression" ||
      typed.type === "FunctionExpression" ||
      typed.type === "FunctionDeclaration";
    for (const key of visitorKeys[typed.type] ?? []) {
      visitAll((typed as unknown as Record<string, unknown>)[key], typed, inner);
    }
  };
  visitAll(fn.body, undefined, false);
}

/** Where the first `await` of a function's body ends, outside the functions in it. */
function firstAwait(body: AST.Node): number | undefined {
  let found: number | undefined;
  const visitAll = (node: unknown): void => {
    if (found !== undefined || !node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) visitAll(item);
      return;
    }
    const typed = node as AST.Node;
    if (typeof typed.type !== "string") return;
    if (
      typed.type === "ArrowFunctionExpression" ||
      typed.type === "FunctionExpression" ||
      typed.type === "FunctionDeclaration"
    ) {
      return;
    }
    if (typed.type === "AwaitExpression") {
      found = typed.end;
      return;
    }
    for (const key of visitorKeys[typed.type] ?? []) {
      visitAll((typed as unknown as Record<string, unknown>)[key]);
    }
  };
  visitAll(body);
  return found;
}

/**
 * `watch(source, callback, options)` (ADR-0048): a source that is a `state` or `derived` ref, a
 * getter, or an array of them (UF2020 for anything else, with a safe fix where it is a prop or a
 * ref's value); a callback written in place; and options `immediate` and `flush`.
 */
function lowerWatch(
  statement: AST.Statement,
  call: AST.CallExpression,
  render: RenderContext,
): SetupItem | undefined {
  const { reporter } = render;
  const [source, handler, options, ...extra] = call.arguments;
  if (extra.length)
    reporter.unsupported(extra[0]!, "`watch` takes a source, a callback and its options.");
  if (!source || source.type === "SpreadElement") {
    reporter.unsupported(source ?? call, "`watch` takes a source and a callback.");
    return undefined;
  }
  let array = false;
  const sources: WatchSource[] = [];
  let valid = true;
  const one = (node: AST.Expression | AST.SpreadElement | null): void => {
    if (node?.type === "Identifier") {
      const binding = setupBindingOf(node, render);
      if (binding?.kind === "state" || binding?.kind === "derived") {
        sources.push(createRefSource(binding.id, span(node)));
        return;
      }
    } else if (node?.type === "ArrowFunctionExpression") {
      const lowered = lowerFunction(node, render, { role: "getter" });
      render.facts.getterKinds.set(lowered.function, lowered.returns);
      sources.push(createGetterSource(lowered.function, span(node)));
      return;
    }
    unwatchable(node, source, render);
    valid = false;
  };
  if (source.type === "ArrayExpression") {
    array = true;
    if (!source.elements.length) one(null);
    for (const element of source.elements) one(element);
  } else {
    one(source);
  }
  if (!callback(handler, "watch", call, render)) return undefined;
  const flags = watchOptions(options, "watch", call, render);
  const fn = handler as AST.ArrowFunctionExpression;
  const lowered = lowerFunction(fn, render, { role: "watch" });
  cleanups(fn, 2, flags?.immediate === true, render);
  if (!valid || !flags) return undefined;
  return createWatchItem(sources, lowered.function, span(statement), { array, ...flags });
}

/**
 * Reports a watcher's source that is no `state` or `derived` ref, getter, or array of them
 * (UF2020): a prop's value, a ref's value, a template ref, a constant. The safe fixes watch a
 * getter of a prop (`() => page`) and a ref itself (`count.value` to `count`). A local function
 * is a getter passed by name (UF2022).
 */
function unwatchable(
  node: AST.Expression | AST.SpreadElement | null,
  source: AST.Expression,
  render: RenderContext,
): void {
  const { reporter, source: text } = render;
  const at = node ?? source;
  if (node?.type === "Identifier") {
    const binding = setupBindingOf(node, render);
    if (binding?.kind === "localFn") {
      reporter.report(
        "UF2022",
        node,
        `\`${node.name}\` is passed to \`watch\` by name as a getter: a watcher's getter is written in place, which the targets write into their own effect.`,
        { help: `Write the getter in place: \`watch(() => …, …)\`.` },
      );
      return;
    }
  }
  let fix: Fix | undefined;
  let what = "This value is no `ref`, `computed` or getter, which nothing can watch";
  if (node?.type === "Identifier") {
    const resolution = render.scopes.resolve(node);
    const binding = setupBindingOf(node, render);
    if (resolution.kind === "parameter" && render.propsByDeclaration.has(resolution.declaration)) {
      what = `\`${node.name}\` is a prop's value, which nothing can watch`;
      fix = getterFix(node, text);
    } else if (binding?.kind === "templateRef") {
      what = `\`${node.name}\` is a template ref, which is never a reactive dependency on every target`;
    } else if (binding?.kind === "model" || (binding?.kind === "context" && binding.ref)) {
      // A watcher's ref sources are state and computed values (ADR-0048): a model or an injected
      // ref is watched through a getter of its value.
      what = `\`${node.name}\` is ${binding.kind === "model" ? "a model" : "an injected ref"}, which a watcher reads through a getter`;
      fix = {
        title: `Watch \`() => ${node.name}.value\``,
        confidence: "safe",
        edits: [{ span: span(node), text: `() => ${node.name}.value` }],
      };
    } else if (binding) {
      what = `\`${node.name}\` is ${binding.kind === "localVar" ? "a setup `let`" : binding.kind === "emit" ? "the component's `emit`" : "a constant"}, which nothing can watch`;
    }
  } else if (node?.type === "MemberExpression" && node.object.type === "Identifier") {
    const binding = setupBindingOf(node.object, render);
    if (
      (binding?.kind === "state" || binding?.kind === "derived") &&
      !node.computed &&
      !node.optional &&
      node.property.type === "Identifier" &&
      node.property.name === "value" &&
      node.object.start === node.start
    ) {
      what = `\`${binding.name}.value\` is the ref's value as the setup runs, which nothing can watch`;
      fix = {
        title: `Watch \`${binding.name}\``,
        confidence: "safe",
        edits: [{ span: span(node), text: binding.name }],
      };
    } else {
      const resolution = render.scopes.resolve(node.object);
      if (
        resolution.kind === "parameter" &&
        resolution.declaration === render.propsObject?.declaration &&
        !node.computed
      ) {
        what = `\`${text.slice(node.start, node.end)}\` is a prop's value, which nothing can watch`;
        fix = getterFix(node, text);
      }
    }
  }
  reporter.report(
    "UF2020",
    at,
    node === null
      ? "An empty array watches nothing: a watcher's source is a `ref` or a `computed`, a getter, or an array of them."
      : `${what}: a watcher's source is a \`ref\` or a \`computed\` (\`watch(count, …)\`), a getter (\`watch(() => page, …)\`), or an array of them.`,
    {
      help: "Watch the ref itself, or a getter that reads the value: `watch(() => page, …)`.",
      ...(fix ? { fixes: [fix] } : {}),
    },
  );
}

/** UF2020's safe fix for a prop's value: a getter that reads it. */
function getterFix(node: AST.Expression, text: string): Fix {
  const written = text.slice(node.start, node.end);
  return {
    title: `Watch \`() => ${written}\``,
    confidence: "safe",
    edits: [{ span: span(node), text: `() => ${written}` }],
  };
}

/**
 * A watcher's options (ADR-0048): an object literal of `immediate: true | false` and
 * `flush: "pre" | "post"`; `watchEffect` takes none or `{ flush: "post" }`. `deep`, `once`, `flush: "sync"` and
 * anything else are not supported (UF1002). `immediate: false` and `flush: "pre"` are the defaults,
 * which one canonical form leaves out (P3): reported with a safe fix that removes them, the whole
 * object where nothing else is left. `immediate` with `flush: "post"` is UF2013: an immediate
 * watcher's first callback runs during the setup, before any DOM, on Vue. Returns the flags, or
 * `undefined` on a problem.
 */
function watchOptions(
  node: AST.Argument | undefined,
  api: "watch" | "watchEffect",
  call: AST.CallExpression,
  render: RenderContext,
): { immediate?: boolean; post?: boolean } | undefined {
  if (!node) return {};
  const { reporter, source } = render;
  const fail = (at: { start: number; end: number }, message: string) => {
    reporter.unsupported(at, message);
    return undefined;
  };
  if (node.type !== "ObjectExpression") {
    return fail(
      node,
      api === "watch"
        ? 'A watcher\'s options are an object literal: `{ immediate: true }`, `{ flush: "post" }`.'
        : '`watchEffect`\'s options are `{ flush: "post" }`, or none.',
    );
  }
  const flags: { immediate?: boolean; post?: boolean } = {};
  let valid = true;
  const defaults: AST.ObjectPropertyKind[] = [];
  let post: AST.ObjectPropertyKind | undefined;
  for (const property of node.properties) {
    const key =
      property.type === "Property" && !property.computed && !property.method && !property.shorthand
        ? property.key.type === "Identifier"
          ? property.key.name
          : property.key.type === "Literal"
            ? String(property.key.value)
            : undefined
        : undefined;
    const value = property.type === "Property" ? property.value : undefined;
    if (
      key === "immediate" &&
      api === "watch" &&
      value?.type === "Literal" &&
      typeof value.value === "boolean"
    ) {
      if (value.value) flags.immediate = true;
      else defaults.push(property);
      continue;
    }
    if (key === "flush" && value?.type === "Literal" && typeof value.value === "string") {
      if (value.value === "post") {
        flags.post = true;
        post = property;
        continue;
      }
      if (value.value === "pre" && api === "watch") {
        defaults.push(property);
        continue;
      }
      valid =
        fail(
          property,
          value.value === "sync"
            ? '`flush: "sync"` is not supported: a watcher runs before the DOM updates or after it, never inside a write.'
            : api === "watchEffect"
              ? '`watchEffect` runs after the DOM updates on every target: its only option is `{ flush: "post" }`.'
              : `\`flush: ${JSON.stringify(value.value)}\` is not a flush: write \`"pre"\` or \`"post"\`.`,
        ) ?? false;
      continue;
    }
    valid =
      fail(
        property,
        key === "deep"
          ? "`deep` is not supported: state is replaced whole (ADR-0008), so a watcher sees every change of its source."
          : key === "once"
            ? "`once` is not supported yet: a watcher runs on every change of its source."
            : api === "watch"
              ? "A watcher's options are `immediate` and `flush`, each a literal."
              : '`watchEffect`\'s only option is `{ flush: "post" }`.',
      ) ?? false;
  }
  if (!valid) return undefined;
  if (flags.immediate && post) {
    reporter.report(
      "UF2013",
      post,
      'An immediate watcher runs its first callback during the setup, before any DOM exists (on the server too, on Vue): `flush: "post"` cannot hold for it.',
      {
        help: 'Read the DOM from `onMounted`, and watch without `immediate`: `watch(source, …, { flush: "post" })`.',
      },
    );
    return undefined;
  }
  if (defaults.length || !node.properties.length) {
    const kept = node.properties.filter((property) => !defaults.includes(property));
    const index = call.arguments.indexOf(node);
    const previous = call.arguments[index - 1];
    const edits: Fix["edits"] = kept.length
      ? [
          {
            span: span(node),
            text: `{ ${kept.map((property) => source.slice(property.start, property.end)).join(", ")} }`,
          },
        ]
      : previous
        ? [{ span: { start: previous.end, end: node.end }, text: "" }]
        : [];
    const [first] = defaults;
    reporter.unsupported(
      first ?? node,
      first
        ? `\`${source.slice(first.start, first.end)}\` is the default: a watcher is written without it, in its one canonical form (ADR-0007).`
        : "An empty options object is the default: a watcher is written without it, in its one canonical form (ADR-0007).",
      {
        help: "Remove it.",
        ...(edits.length
          ? {
              fixes: [
                {
                  title: kept.length ? "Remove the default" : "Remove the options",
                  confidence: "safe",
                  edits,
                },
              ],
            }
          : {}),
      },
    );
    return undefined;
  }
  return flags;
}

/**
 * Finds the parameter of each local function that receives an event (ADR-0047): the first of a
 * function a listener names (`onClick={save}`), and any an inline handler, or a function that
 * takes an event itself, passes its event to (`(event) => pick(item, event)`). Its interface is
 * its annotation's, or the nearest one every event it receives extends.
 */
function findEventParameters(
  context: SetupContext,
  bindings: ReadonlyMap<object, SetupBinding>,
  found: Map<SetupFunction, EventParameter>,
): void {
  const uses = new Map<SetupFunction, { index: number; interfaces: string[]; events: string[] }>();
  const functionOf = (identifier: AST.Node): SetupFunction | undefined => {
    if (identifier.type !== "Identifier") return undefined;
    const resolution = context.scopes.resolve(identifier as AST.IdentifierReference);
    if (resolution.kind !== "variable" || resolution.scope !== context.component) return undefined;
    return bindings.get(resolution.declaration)?.function;
  };
  const use = (fn: SetupFunction, index: number, dom: string, events: readonly string[]) => {
    const known = uses.get(fn);
    if (known && known.index !== index) return;
    if (!known) {
      uses.set(fn, { index, interfaces: [dom], events: [...events] });
      return;
    }
    known.interfaces.push(dom);
    for (const event of events) if (!known.events.includes(event)) known.events.push(event);
  };
  /** The calls in `node` that pass the identifier `parameter` declares to a local function. */
  const passes = (node: unknown, parameter: object, dom: string, events: readonly string[]) => {
    visit(node, (child) => {
      if (child.type !== "CallExpression") return;
      const callee = functionOf(child.callee);
      if (!callee) return;
      for (const [index, argument] of child.arguments.entries()) {
        if (argument.type !== "Identifier") continue;
        const resolution = context.scopes.resolve(argument);
        if (resolution.kind === "parameter" && resolution.declaration === parameter) {
          use(callee, index, dom, events);
        }
      }
    });
  };
  // A component's `onX` listens to an event its child declares, whose payload is no DOM event
  // (ADR-0053): its attributes are left out.
  const componentAttributes = new Set<object>();
  visit(context.returned, (node) => {
    if (
      node.type === "JSXOpeningElement" &&
      node.name.type === "JSXIdentifier" &&
      /^[A-Z]/.test(node.name.name)
    ) {
      for (const attribute of node.attributes) componentAttributes.add(attribute);
    }
    if (node.type !== "JSXAttribute" || node.name.type !== "JSXIdentifier") return;
    if (componentAttributes.has(node)) return;
    const name = listenerName(node.name.name);
    if (!name || node.value?.type !== "JSXExpressionContainer") return;
    const dom = DOM_EVENTS.get(name.event) ?? "Event";
    const { expression } = node.value;
    const named = functionOf(expression as AST.Node);
    if (named) {
      use(named, 0, dom, [name.event]);
    } else if (expression.type === "ArrowFunctionExpression") {
      const [parameter] = expression.params;
      if (parameter?.type !== "Identifier") return;
      const annotation = annotatedInterface(parameter).interface;
      passes(expression.body, parameter, annotation ?? dom, [name.event]);
    }
  });
  // A function that takes an event passes it on: followed until nothing new is found (a map
  // iterates the entries added while it does).
  const known = () => [...uses.values()].reduce((sum, use) => sum + 1 + use.events.length, 0);
  for (let size = -1; size !== known();) {
    size = known();
    for (const [fn, { index, interfaces, events }] of uses) {
      const parameter = fn.params[index];
      if (parameter?.type !== "Identifier") continue;
      const dom = annotatedInterface(parameter).interface ?? common(interfaces);
      passes(fn.body, parameter, dom, events);
    }
  }
  for (const [fn, { index, interfaces, events }] of uses) {
    const parameter = fn.params[index];
    if (parameter?.type !== "Identifier") continue;
    const annotation = annotatedInterface(parameter);
    if (annotation.annotated && !annotation.interface) continue;
    found.set(fn, { index, interface: annotation.interface ?? common(interfaces), events });
  }
}

/**
 * The camelCase spelling of an event's name written otherwise (UF2008's fix): `level-change` is
 * `levelChange`, `Change` is `change`, `onSave` is `save`; `undefined` where none is one.
 */
function canonicalEventName(name: string): string | undefined {
  const words = name.split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (!words.length) return undefined;
  let result = words
    .map((word, index) => (index ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join("");
  if (/^on[A-Z]/.test(result)) result = result.slice(2);
  result = result.charAt(0).toLowerCase() + result.slice(1);
  return /^[a-z][A-Za-z0-9]*$/.test(result) ? result : undefined;
}

/** The nearest event interface every one of `interfaces` is or extends. */
function common(interfaces: readonly string[]): string {
  for (let current: string | null | undefined = interfaces[0]; current;) {
    if (interfaces.every((name) => extendsEventInterface(name, current!))) return current;
    current = EVENT_INTERFACES.get(current);
  }
  return "Event";
}

/** Visits every node in a tree, depth first. */
function visit(node: unknown, enter: (node: AST.Node) => void): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) visit(item, enter);
    return;
  }
  const typed = node as AST.Node;
  if (typeof typed.type !== "string") return;
  enter(typed);
  for (const key of visitorKeys[typed.type] ?? []) {
    visit((typed as unknown as Record<string, unknown>)[key], enter);
  }
}

/** Whether a node holds JSX anywhere in it. */
function holdsJsx(node: unknown): boolean {
  let found = false;
  visit(node, (child) => {
    if (child.type === "JSXElement" || child.type === "JSXFragment") found = true;
  });
  return found;
}

/** The `return` statements in a statement, outside the functions in it. */
function returnsIn(statement: AST.Statement): AST.ReturnStatement[] {
  const found: AST.ReturnStatement[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    const typed = node as AST.Node;
    if (
      typed.type === "ArrowFunctionExpression" ||
      typed.type === "FunctionExpression" ||
      typed.type === "FunctionDeclaration" ||
      typed.type === "ClassDeclaration" ||
      typed.type === "ClassExpression"
    ) {
      return;
    }
    if (typed.type === "ReturnStatement") found.push(typed);
    for (const key of visitorKeys[typed.type] ?? []) {
      walk((typed as unknown as Record<string, unknown>)[key]);
    }
  };
  walk(statement);
  return found;
}

/** The authoring APIs a statement uses, each with whether it is called. */
function apisIn(
  statement: AST.Statement,
  context: SetupContext,
): { identifier: AST.IdentifierReference; called: boolean }[] {
  const found: { identifier: AST.IdentifierReference; called: boolean }[] = [];
  const callees = new Set<object>();
  visit(statement, (node) => {
    if (node.type === "CallExpression") callees.add(node.callee);
    if (node.type !== "Identifier") return;
    const resolution = context.scopes.resolve(node as AST.IdentifierReference);
    if (resolution.kind !== "import" || !context.authoring.get(resolution.declaration)) return;
    found.push({ identifier: node as AST.IdentifierReference, called: callees.has(node) });
  });
  return found;
}

/** Whether a statement is a directive prologue entry: `"use strict";`, not just any expression. */
export function isDirective(statement: AST.Directive | AST.Statement): statement is AST.Directive {
  // oxc sets `directive` on every expression statement, to `null` on one that is no directive.
  return (
    statement.type === "ExpressionStatement" &&
    typeof (statement as { directive?: unknown }).directive === "string"
  );
}

/**
 * A directive. `"use strict"` changes nothing in a module, which is strict; any other belongs
 * to a framework or a bundler (`"use client"`), which the compiler does not write for a target.
 */
export function checkDirective(statement: AST.Directive, reporter: Reporter): void {
  if (statement.directive === "use strict") return;
  reporter.unsupported(
    statement,
    `Directives such as ${statement.expression.raw ?? JSON.stringify(statement.directive)} are not supported yet: each target's output carries the directives its framework needs.`,
  );
}

/** The `never` default of an exhaustive switch: a kind added to a union fails type checking. */
function unreachable(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}
