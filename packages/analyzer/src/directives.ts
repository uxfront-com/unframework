// Directives (ADR-0099): `const vFocusTrap = defineDirective<boolean>({ mounted(el, value) {…} })`
// at a module's top level, applied as `v-focus-trap={open.value}` on an element. A `.uf.ts`
// module exports its directives, and each compiles to one module per target; a `.uf.tsx` module
// may declare its own, which every output that applies one declares. The hooks run in the browser
// only, so they read their own names, the globals client code reads, and the module's constants
// and the values it imports (ADR-0070), never the authoring API or a component's bindings.

import {
  CLIENT_GLOBALS,
  createBinding,
  createBindingReference,
  createCode,
  createDirective,
  createDirectiveHook,
  createExpression,
  createDirectiveAttribute,
  createGlobalReference,
  createTypeText,
  isDirectiveName,
  WINDOW_MEMBER_GLOBALS,
} from "@unframework.dev/ir";
import type {
  Attribute,
  Binding,
  CodeReference,
  DirectiveHook,
  UfDirective,
} from "@unframework.dev/ir";
import { visitorKeys } from "@unframework.dev/parser";
import type { AST, ParsedModule } from "@unframework.dev/parser";
import type { DirectiveValueCheck, DirectiveValueQuery } from "@unframework.dev/type-oracle";

import type { ElementContext } from "./attributes.ts";
import type { AuthoringApi } from "./authoring.ts";
import type { Reporter } from "./context.ts";
import { checkCopiedText, closure } from "./declarations.ts";
import type { ModuleTypes } from "./declarations.ts";
import { checkExpression, span } from "./expressions.ts";
import type { SetupBinding } from "./render.ts";
import type { Scopes } from "./scope.ts";
import { visit as walk } from "./shapes.ts";
import type { SharedValues } from "./shared.ts";

/** The hooks a directive may declare, with how many parameters each takes at most. */
const HOOKS: Readonly<Record<DirectiveHook["name"], number>> = {
  mounted: 2,
  updated: 3,
  unmounted: 1,
};

/** The parameters each hook takes, as the help names them. */
const HOOK_SIGNATURES: Readonly<Record<DirectiveHook["name"], string>> = {
  mounted: "mounted(el, value)",
  updated: "updated(el, value, oldValue)",
  unmounted: "unmounted(el)",
};

/** A directive the module declares, before its hooks are lowered. */
export interface DirectiveCandidate {
  /** The `const` declaration, or the `export` around it. */
  statement: AST.VariableDeclaration | AST.ExportNamedDeclaration;
  declarator: AST.VariableDeclarator & { id: AST.BindingIdentifier };
  call: AST.CallExpression;
  exported: boolean;
}

/** What an element reads of a directive it applies: its name, and what its hooks read. */
export interface DirectiveInfo {
  name: string;
  /**
   * For a directive of the module, the module's constants and value imports its hooks read,
   * which each component that applies it declares as it does what it reads itself. An imported
   * directive's module declares its own, so it has none.
   */
  bindings: readonly Binding[];
}

/** What lowering a module's directives needs to know. */
export interface DirectiveContext {
  source: string;
  scopes: Scopes;
  reporter: Reporter;
  types: ModuleTypes;
  authoring: ReadonlyMap<object, AuthoringApi | undefined>;
  shared: SharedValues;
  /** Whether the module is a `.uf.ts` module, whose directives are exported. */
  composableModule: boolean;
}

/** The help of UF2037 that shows a directive's declaration. */
const DECLARATION_HELP =
  "Declare it at the module's top level: `export const vFocusTrap = defineDirective<boolean>({ mounted(el, value) { … } });`.";

/** Whether an expression calls the authoring API's `defineDirective`, by the binding its import declares. */
export function isDirectiveCall(
  node: AST.Node | null | undefined,
  scopes: Scopes,
  authoring: ReadonlyMap<object, AuthoringApi | undefined>,
): node is AST.CallExpression {
  const inner = node && unwrapped(node);
  if (inner?.type !== "CallExpression" || inner.callee.type !== "Identifier") return false;
  const resolution = scopes.resolve(inner.callee as AST.IdentifierReference);
  return (
    resolution.kind === "import" && authoring.get(resolution.declaration) === "defineDirective"
  );
}

/** Reports `defineDirective` called anywhere but as a top-level `const`'s value (UF2037). */
export function misplacedDirective(callee: AST.IdentifierReference, reporter: Reporter): void {
  reporter.report(
    "UF2037",
    callee,
    `\`${callee.name}\` declares a directive as the value of a \`const\` at the module's top level, where every output that applies it can declare it once.`,
    { help: DECLARATION_HELP },
  );
}

/**
 * The directive a top-level `const` declares, if `defineDirective` is its value: a candidate, or
 * `undefined` for any other `const`.
 */
export function directiveCandidate(
  statement: AST.VariableDeclaration,
  exported: AST.ExportNamedDeclaration | undefined,
  scopes: Scopes,
  authoring: ReadonlyMap<object, AuthoringApi | undefined>,
): DirectiveCandidate | undefined {
  if (statement.declarations.length !== 1) return undefined;
  const [declarator] = statement.declarations;
  if (!declarator || declarator.id.type !== "Identifier") return undefined;
  if (!isDirectiveCall(declarator.init, scopes, authoring)) return undefined;
  return {
    statement: exported ?? statement,
    declarator: declarator as DirectiveCandidate["declarator"],
    call: unwrapped(declarator.init!) as AST.CallExpression,
    exported: exported !== undefined,
  };
}

/**
 * Lowers the module's directives, once every import and constant is known, reporting UF2037 for
 * one that is not written in the canonical form. Returns the directives that lowered, and what an
 * element reads of each, by its name: a reported one too, so that its uses report nothing more.
 */
export function lowerDirectives(
  candidates: readonly DirectiveCandidate[],
  context: DirectiveContext,
): { directives: UfDirective[]; infos: Map<string, DirectiveInfo> } {
  const directives: UfDirective[] = [];
  const infos = new Map<string, DirectiveInfo>();
  for (const candidate of candidates) {
    const lowered = lowerDirective(candidate, context);
    infos.set(candidate.declarator.id.name, {
      name: candidate.declarator.id.name,
      bindings: lowered?.bindings ?? [],
    });
    if (lowered) directives.push(lowered);
  }
  return { directives, infos };
}

function lowerDirective(
  candidate: DirectiveCandidate,
  context: DirectiveContext,
): UfDirective | undefined {
  const { source, reporter, composableModule } = context;
  const { declarator, call, statement } = candidate;
  const { id } = declarator;
  const mark = reporter.diagnostics.length;
  const kind = (
    statement.type === "ExportNamedDeclaration"
      ? (statement.declaration as AST.VariableDeclaration)
      : statement
  ).kind;
  if (kind !== "const") {
    reporter.report(
      "UF2037",
      statement,
      `A directive is declared with \`const\`, and \`${id.name}\` with \`${kind}\`: every output declares it once, read-only.`,
      { help: DECLARATION_HELP },
    );
  }
  if (!isDirectiveName(id.name)) {
    const meant = `v${id.name.replace(/^v(?=[A-Z])/, "").replace(/^[a-z]/, (letter) => letter.toUpperCase())}`;
    reporter.report(
      "UF2037",
      id,
      `\`${id.name}\` is no directive's name: a directive is named \`v\` and an upper-case letter, in ASCII letters and digits, which an element writes in kebab case (\`vFocusTrap\` as \`v-focus-trap\`).`,
      { help: isDirectiveName(meant) ? `Name it \`${meant}\`.` : DECLARATION_HELP },
    );
  }
  if (isDirectiveName(id.name) && RESERVED_DIRECTIVES.has(`v-${kebab(id.name)}`)) {
    reporter.report(
      "UF2037",
      id,
      `\`${id.name}\` is applied as \`v-${kebab(id.name)}\`, which is Vue's own directive: Vue's template would read it as its own.`,
      { help: "Give the directive another name." },
    );
  }
  if (composableModule && !candidate.exported) {
    reporter.report(
      "UF2037",
      id,
      `\`${id.name}\` is a directive the module does not export: a \`.uf.ts\` module's directive is a named export, compiled to a module of its own on every target.`,
      { help: `Export it: \`export const ${id.name} = defineDirective…\`.` },
    );
  }
  if (id.typeAnnotation) {
    reporter.report(
      "UF2037",
      id.typeAnnotation,
      `\`${id.name}\` is annotated: a directive's types are \`defineDirective\`'s type arguments, which every target reads.`,
      { help: `Remove the annotation, and write the value's type as \`defineDirective<T>(…)\`.` },
    );
  }
  checkCopiedText(span(statement), source, reporter, "A directive");
  const callee = call.callee as AST.IdentifierReference;
  const typeArguments = call.typeArguments?.params ?? [];
  const [value, element] = typeArguments;
  if (!value || typeArguments.length > 2) {
    reporter.report(
      "UF2037",
      call.typeArguments ?? callee,
      value
        ? `\`${callee.name}\` takes at most two type arguments: the value's type, and the element's.`
        : `\`${callee.name}\` takes the value's type as its type argument: the hooks' parameters take their types from it.`,
      {
        help: `Write \`${callee.name}<boolean>({ … })\`, or \`${callee.name}<boolean, HTMLDialogElement>({ … })\`.`,
      },
    );
  }
  const [hooksArgument, extra] = call.arguments;
  if (!hooksArgument || extra || unwrapped(hooksArgument).type !== "ObjectExpression") {
    reporter.report(
      "UF2037",
      extra ?? hooksArgument ?? call,
      `\`${callee.name}\` takes one object literal of hooks: \`mounted\`, \`updated\` and \`unmounted\`, written as methods.`,
      { help: DECLARATION_HELP },
    );
    return undefined;
  }
  const object = unwrapped(hooksArgument) as AST.ObjectExpression;
  const hooks: DirectiveHook[] = [];
  const seen = new Map<string, AST.Node>();
  const bindings: Binding[] = [];
  const typeNodes: unknown[] = [value, element];
  for (const property of object.properties) {
    const hook = hookOf(property, seen, reporter);
    if (!hook) continue;
    typeNodes.push(hook.fn);
    const body = hook.fn.body!;
    const refs = hookReferences(hook.fn, bindings, context, id.name);
    hooks.push(
      createDirectiveHook(
        hook.name,
        hook.parameters,
        createCode(source.slice(body.start, body.end), span(body), refs),
        { start: property.start, end: property.end },
        hook.fn.async,
      ),
    );
  }
  if (!object.properties.length) {
    reporter.report(
      "UF2037",
      object,
      `\`${id.name}\` declares no hook: a directive runs \`mounted\`, \`updated\` or \`unmounted\`, at least one of them.`,
      { help: DECLARATION_HELP },
    );
  }
  if (reporter.hasErrorsSince(mark) || !value) return undefined;
  const declared = new Set(context.types.declarations.map(({ name }) => name));
  const types = closure(typeNodes, context.types.table).filter((name) => declared.has(name));
  return createDirective(
    id.name,
    createTypeText(source.slice(value.start, value.end), span(value)),
    hooks,
    span(statement),
    {
      exported: candidate.exported,
      ...(element
        ? { element: createTypeText(source.slice(element.start, element.end), span(element)) }
        : {}),
      bindings: bindings.toSorted((a, b) => a.span.start - b.span.start),
      types: context.types.declarations
        .filter(({ name }) => types.includes(name))
        .map(({ name }) => name),
    },
  );
}

/** A property of the hooks' object, checked as a hook (UF2037), or `undefined` when reported. */
function hookOf(
  property: AST.ObjectPropertyKind,
  seen: Map<string, AST.Node>,
  reporter: Reporter,
): { name: DirectiveHook["name"]; parameters: string[]; fn: AST.Function } | undefined {
  if (property.type === "SpreadElement") {
    reporter.report("UF2037", property, "A directive's hooks are written out, never spread.", {
      help: DECLARATION_HELP,
    });
    return undefined;
  }
  const key = property.computed ? undefined : property.key;
  const name =
    key?.type === "Identifier" ? key.name : key?.type === "Literal" ? String(key.value) : undefined;
  if (name === undefined || !Object.hasOwn(HOOKS, name)) {
    reporter.report(
      "UF2037",
      property.key,
      `${name === undefined ? "This" : `\`${name}\``} is no hook of a directive's: its hooks are \`mounted\`, \`updated\` and \`unmounted\`.`,
      {
        help: "Write the hooks the directive needs: `mounted(el, value)`, `updated(el, value, oldValue)` and `unmounted(el)`.",
      },
    );
    return undefined;
  }
  const hook = name as DirectiveHook["name"];
  const first = seen.get(hook);
  if (first) {
    reporter.report("UF2037", property.key, `\`${hook}\` is declared twice in this directive.`, {
      help: "Keep one.",
      related: [{ span: span(first), message: "First declared here" }],
    });
    return undefined;
  }
  seen.set(hook, property.key);
  const fn = property.value;
  if (!property.method || property.kind !== "init" || fn.type !== "FunctionExpression") {
    reporter.report(
      "UF2037",
      property,
      `A directive's \`${hook}\` is written as a method: \`${HOOK_SIGNATURES[hook]} { … }\`.`,
      { help: `Write \`${HOOK_SIGNATURES[hook]} { … }\`.` },
    );
    return undefined;
  }
  if (fn.generator || !fn.body) {
    reporter.report(
      "UF2037",
      property.key,
      `A directive's \`${hook}\` is a plain method, never a generator.`,
      {
        help: `Write \`${HOOK_SIGNATURES[hook]} { … }\`.`,
      },
    );
    return undefined;
  }
  if (fn.typeParameters || fn.returnType) {
    reporter.report(
      "UF2037",
      fn.typeParameters ?? fn.returnType!,
      `A directive's \`${hook}\` takes its types from \`defineDirective\`'s type arguments, and declares none of its own.`,
      { help: `Write \`${HOOK_SIGNATURES[hook]} { … }\`.` },
    );
    return undefined;
  }
  const parameters: string[] = [];
  let ok = true;
  for (const parameter of fn.params) {
    if (parameter.type !== "Identifier" || parameter.typeAnnotation || parameter.optional) {
      reporter.report(
        "UF2037",
        parameter,
        `A directive's \`${hook}\` takes plain names as its parameters, unannotated: their types are \`defineDirective\`'s type arguments.`,
        { help: `Write \`${HOOK_SIGNATURES[hook]} { … }\`.` },
      );
      ok = false;
      continue;
    }
    parameters.push(parameter.name);
  }
  if (fn.params.length > HOOKS[hook]) {
    reporter.report(
      "UF2037",
      fn.params[HOOKS[hook]]!,
      `A directive's \`${hook}\` takes at most ${HOOKS[hook]} parameter${HOOKS[hook] === 1 ? "" : "s"}: \`${HOOK_SIGNATURES[hook]}\`.`,
      { help: `Write \`${HOOK_SIGNATURES[hook]} { … }\`.` },
    );
    ok = false;
  }
  return ok ? { name: hook, parameters, fn } : undefined;
}

/**
 * The references of a hook's body, in source order (ADR-0099): the module's constants and value
 * imports it reads, each added to `bindings` once, and the globals client code may read. Its own
 * parameters and locals are its own. Anything else is UF2037: the authoring API, a component, a
 * helper, another directive, a key, a global only a `window` member reads, or none at all.
 */
function hookReferences(
  fn: AST.Function,
  bindings: Binding[],
  context: DirectiveContext,
  directive: string,
): CodeReference[] {
  const { scopes, reporter, shared, authoring } = context;
  const refs: CodeReference[] = [];
  const reject = (node: AST.Node, message: string, help?: string) =>
    reporter.report("UF2037", node, message, {
      help:
        help ??
        "A hook reads its parameters, its own names, the browser's globals and, in a `.uf.ts` module, the module's constants and the values it imports from shared `.ts` modules.",
    });
  const visit = (node: unknown, parent: AST.Node | undefined): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item, parent);
      return;
    }
    const typed = node as AST.Node;
    if (typeof typed.type !== "string") return;
    switch (typed.type) {
      case "ThisExpression":
        reject(
          typed,
          `\`this\` is not supported in a directive's hook: it reads its element as its first parameter.`,
        );
        return;
      case "JSXElement":
      case "JSXFragment":
        reject(typed, "A directive's hook renders nothing, so it holds no JSX.");
        return;
      case "ImportExpression":
      case "MetaProperty":
        reject(
          typed,
          "A directive's hook loads no module: it imports what it reads at the module's top level.",
        );
        return;
      case "Identifier": {
        if (!scopes.isReference(typed)) break;
        const identifier = typed as AST.IdentifierReference;
        const shorthand = parent?.type === "Property" && parent.shorthand && parent.value === typed;
        reference(identifier, shorthand);
        return;
      }
      default:
        break;
    }
    for (const key of visitorKeys[typed.type] ?? []) {
      visit((typed as unknown as Record<string, unknown>)[key], typed);
    }
  };
  const reference = (node: AST.IdentifierReference, shorthand: boolean): void => {
    const resolution = scopes.resolve(node);
    switch (resolution.kind) {
      case "parameter":
        return;
      case "variable": {
        if ((resolution.scope as AST.Node).type !== "Program") return;
        const value = shared.values.get(resolution.declaration);
        if (value?.kind === "moduleConst") {
          read(node, value.name, value.kind, value.span, value.id, shorthand);
          return;
        }
        reject(
          node,
          resolution.declares === "variable"
            ? `\`${node.name}\` is declared at the module's top level, and is no constant a directive's hook reads${node.name === directive ? ": a hook reads its element and its value from its parameters" : ""}.`
            : `\`${node.name}\` is a component or a helper of the module, which a directive's hook does not call.`,
        );
        return;
      }
      case "import": {
        const value = shared.values.get(resolution.declaration);
        if (value?.kind === "import") {
          read(node, value.name, value.kind, value.span, value.id, shorthand);
          return;
        }
        if (shared.failed.has(resolution.declaration)) return;
        if (authoring.has(resolution.declaration)) {
          reject(
            node,
            `\`${node.name}\` is the authoring API's, which a directive's hook never calls: it runs in the browser, apart from any component's setup.`,
            "Keep a component's state in the component, and pass what the hook needs as the directive's value.",
          );
          return;
        }
        reject(
          node,
          `\`${node.name}\` is imported from a module whose values a directive's hook does not read: it reads the values of shared \`.ts\` modules.`,
        );
        return;
      }
      case "global": {
        if (CLIENT_GLOBALS.has(node.name)) {
          refs.push(createGlobalReference(node.name, span(node)));
          return;
        }
        reject(
          node,
          WINDOW_MEMBER_GLOBALS.has(node.name)
            ? `\`${node.name}\` is read through \`window\` in a directive's hook, as in client code.`
            : `\`${node.name}\` is not declared, and is no global a directive's hook may read.`,
          WINDOW_MEMBER_GLOBALS.has(node.name) ? `Write \`window.${node.name}\`.` : undefined,
        );
        return;
      }
      case "other":
        if (node.name === "arguments") {
          reject(
            node,
            "`arguments` is not supported in a directive's hook: it names its parameters.",
          );
        }
        return;
      default:
        return;
    }
  };
  const read = (
    node: AST.IdentifierReference,
    name: string,
    kind: "moduleConst" | "import",
    at: { start: number; end: number },
    id: string,
    shorthand: boolean,
  ): void => {
    if (!bindings.some((binding) => binding.id === id))
      bindings.push(createBinding(name, kind, at));
    refs.push(createBindingReference(id, span(node), shorthand));
  };
  visit(fn.body, undefined);
  return refs.toSorted((a, b) => a.span.start - b.span.start);
}

/**
 * The type oracle's answer for a directive's value, by the value's span (ADR-0109): `undefined`
 * for a value it was not asked about or could not type.
 */
export type DirectiveValues = (value: {
  start: number;
  end: number;
}) => DirectiveValueCheck | undefined;

/**
 * Each directive's value a module writes that the type oracle can check against the directive's
 * `T` (ADR-0109), in source order, read from the syntax only: every `v-<kebab>` attribute with a
 * value, a non-empty container or a string, whose directive is a top-level `const` of the module
 * or a name it imports. What `compile()` asks the oracle for before the module is analysed.
 */
export function directiveValueQueries(parsed: ParsedModule): DirectiveValueQuery[] {
  const names = new Map<string, { start: number; end: number }>();
  for (const statement of parsed.program.body) {
    if (statement.type === "ImportDeclaration") {
      if (statement.importKind === "type") continue;
      for (const specifier of statement.specifiers) {
        if (specifier.type === "ImportSpecifier" && specifier.importKind !== "type") {
          names.set(specifier.local.name, span(specifier.local));
        }
      }
      continue;
    }
    const declaration =
      statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
    if (declaration?.type !== "VariableDeclaration" || declaration.kind !== "const") continue;
    for (const declarator of declaration.declarations) {
      if (declarator.id.type === "Identifier") names.set(declarator.id.name, span(declarator.id));
    }
  }
  const queries: DirectiveValueQuery[] = [];
  if (!names.size) return queries;
  walk(parsed.program, (node) => {
    if (node.type !== "JSXAttribute" || node.name.type !== "JSXIdentifier") return true;
    const authored = node.name.name;
    const name = isDirectiveAttribute(authored) ? directiveNameOf(authored) : undefined;
    const directive = name === undefined ? undefined : names.get(name);
    if (!directive) return true;
    const value = node.value;
    if (value?.type === "Literal") {
      // A static value holding `\`, `&` or a line break is UF1002 (`lowerDirectiveAttribute`),
      // and it reads otherwise in JavaScript, where the oracle types it: it is not asked about.
      const raw = parsed.source.slice(value.start, value.end);
      if (!/[\\&\r\n]/.test(raw)) queries.push({ value: span(value), kind: "string", directive });
    } else if (
      value?.type === "JSXExpressionContainer" &&
      value.expression.type !== "JSXEmptyExpression"
    ) {
      queries.push({ value: span(value.expression), kind: "expression", directive });
    }
    return true;
  });
  return queries.toSorted((a, b) => a.value.start - b.value.start);
}

/**
 * Reports a lowered directive's value whose type the type oracle found is not the directive's
 * `T` (UF6007, ADR-0109), and gives whether it did.
 */
function reportsValueType(
  value: AST.Node,
  authored: string,
  name: string,
  render: ElementContext["render"],
): boolean {
  const check = render.directiveValues?.(span(value));
  if (!check || check.assignable) return false;
  render.reporter.report(
    "UF6007",
    value,
    `\`${authored}\`'s value is ${code(check.value)}, and \`${name}\` takes ${code(check.expected)}.`,
    {
      help: `Pass a value of type ${code(check.expected)}, or change the type argument of \`${name}\`'s \`defineDirective\`.`,
    },
  );
  return true;
}

/**
 * A printed type as a code span: one that holds a backtick, a template literal type, takes two,
 * with a space inside each end (CommonMark), so it still reads as one span.
 */
function code(text: string): string {
  return text.includes("`") ? `\`\` ${text} \`\`` : `\`${text}\``;
}

/** The name a `v-` attribute applies, `vFocusTrap` for `v-focus-trap`, or `undefined` for one not in kebab case. */
export function directiveNameOf(attribute: string): string | undefined {
  if (!/^v(?:-[a-z][a-z0-9]*)+$/.test(attribute)) return undefined;
  return `v${attribute
    .slice(2)
    .split("-")
    .map((part) => `${part[0]!.toUpperCase()}${part.slice(1)}`)
    .join("")}`;
}

/**
 * Lowers `v-name={value}` on an element (ADR-0099): a directive the module declares or imports
 * (UF3055), outside a list's body (UF1002, not supported yet), with a value that is not built in
 * place (UF3056). Returns the attribute, or `undefined` when it is reported.
 */
export function lowerDirectiveAttribute(
  item: AST.JSXAttribute,
  nameNode: AST.JSXIdentifier,
  element: ElementContext,
  directives: ReadonlyMap<string, DirectiveInfo>,
): Attribute | undefined {
  const { render } = element;
  const { reporter, source } = render;
  const authored = nameNode.name;
  const name = directiveNameOf(authored);
  if (name === undefined) {
    reporter.unsupported(
      nameNode,
      `\`${authored}\` is no directive's name in kebab case: a directive's arguments (\`v-name:arg\`) and modifiers (\`v-name_mod\`) are not supported yet.`,
      {
        help: "Apply a directive by its name in kebab case, `v-focus-trap` for `vFocusTrap`, and pass what it needs as its value.",
      },
    );
    return undefined;
  }
  const info = directives.get(name);
  if (!info) {
    const other = [...render.shared.values.values()].find((value) => value.name === name);
    reporter.report(
      "UF3055",
      nameNode,
      other
        ? `\`${authored}\` applies \`${name}\`, which is ${other.kind === "moduleConst" ? "a constant of the module" : "a value the module imports"}, not a directive.`
        : `\`${authored}\` applies \`${name}\`, and the module declares or imports no directive of that name.`,
      {
        help: `Import it from the \`.uf.ts\` module that exports it, \`import { ${name} } from "./…uf.ts";\`, or declare it at the module's top level with \`defineDirective\`.`,
      },
    );
    return undefined;
  }
  // A prop or a setup name of the directive's would take its place in the outputs that resolve a
  // directive by its name (Vue's `<script setup>`), or pass a value as the hooks (React). It is
  // reported once, at its declaration where it has one.
  const local = [...render.setup.bindings.values()].find((binding) => binding.name === name);
  if (local || render.props.has(name)) {
    const reported = shadowsReported.get(render.component) ?? new Set<string>();
    shadowsReported.set(render.component, reported);
    if (!reported.has(name)) {
      reported.add(name);
      reporter.report(
        "UF3024",
        local?.declaration ?? nameNode,
        `\`${name}\` is ${local ? "declared in the setup" : "a prop"}, and shadows the directive \`${authored}\` applies: the outputs that resolve a directive by its name would read it instead.`,
        { help: `Rename the ${local ? "local" : "prop"}: no directive needs to share its name.` },
      );
    }
    return undefined;
  }
  if (render.enclosing.length) {
    reporter.unsupported(
      nameNode,
      `\`${authored}\` on an element in a list's body is not supported yet: React and Qwik give a directive's state to the component, which renders it once.`,
      {
        help: "Apply the directive to an element around the list, or render each row as a component of its own, whose element applies it.",
      },
    );
    return undefined;
  }
  const value = item.value;
  if (value === null) {
    reporter.report(
      "UF3056",
      nameNode,
      `\`${authored}\` is written without a value: a directive's hooks receive one.`,
      {
        help: `Write \`${authored}={value}\`, or \`${authored}={true}\` for a directive that needs none.`,
      },
    );
    return undefined;
  }
  if (value.type === "Literal") {
    const raw = source.slice(value.start, value.end);
    if (/[\\&\r\n]/.test(raw)) {
      reporter.unsupported(
        value,
        `A static \`${authored}\` holding \`\\\`, \`&\` or a line break is not supported: JSX reads it as written, and the targets' templates would read its escapes.`,
        { help: `Write it as an expression: \`${authored}={${JSON.stringify(value.value)}}\`.` },
      );
      return undefined;
    }
    if (reportsValueType(value, authored, name, render)) return undefined;
    declareReads(info, render);
    return createDirectiveAttribute(name, createExpression(raw, span(value)), span(item));
  }
  if (value.type !== "JSXExpressionContainer") {
    reporter.report(
      "UF3012",
      value,
      "JSX cannot be an attribute's value: only a child, a branch of a conditional child or the element a list's `.map` renders.",
      {
        help: `Write the JSX as children, and pass the directive a value: \`${authored}={open.value}\`.`,
      },
    );
    return undefined;
  }
  if (value.expression.type === "JSXEmptyExpression") {
    reporter.report(
      "UF3056",
      value,
      `\`${authored}\`'s value is empty: a directive's hooks receive one.`,
      {
        help: `Write \`${authored}={value}\`.`,
      },
    );
    return undefined;
  }
  const inner = unwrapped(value.expression);
  const fresh = freshValue(inner);
  if (fresh) {
    reporter.report(
      "UF3056",
      value.expression,
      `\`${authored}\`'s value is ${fresh} built in place: it is a new value at every render on React and Vue, which runs \`updated\` each time, and the same one on Svelte, which never does.`,
      {
        help: "Pass a value that changes only when it should: a state, a derived value (`computed(() => ({ … }))`), a prop, a setup function or a primitive.",
      },
    );
    return undefined;
  }
  // A setup function, which the hooks call (click-outside's callback): passed by its name, as a
  // listener names it, never called in the template.
  const fn = setupFunction(inner, render);
  if (fn) {
    if (reportsValueType(value.expression, authored, name, render)) return undefined;
    declareReads(info, render);
    return createDirectiveAttribute(
      name,
      createExpression(
        source.slice(value.expression.start, value.expression.end),
        span(value.expression),
        [createBindingReference(fn.id, span(inner))],
      ),
      span(item),
    );
  }
  const mark = reporter.diagnostics.length;
  const checked = checkExpression(value.expression, { ...render, directiveValue: true });
  if (!checked.clean || reporter.hasErrorsSince(mark)) return undefined;
  // One helper call per use gives React and Qwik one value, where a scoped fill's variables may
  // differ at each call, as a list's row does.
  const variable = checked.expression.refs.flatMap((reference) =>
    reference.kind === "Binding" && render.fillVariables.has(reference.binding)
      ? [reference.binding.slice(0, reference.binding.lastIndexOf("@"))]
      : [],
  )[0];
  if (variable !== undefined) {
    reporter.unsupported(
      value.expression,
      `\`${authored}\`'s value reads \`${variable}\`, which the scoped slot's fill declares, and that is not supported yet: React and Qwik give a directive one value per use, where the child may call the fill with other props each time.`,
      {
        help: "Read only the component's own names in the value, or render each row as a component of its own, whose element applies the directive.",
      },
    );
    return undefined;
  }
  if (reportsValueType(value.expression, authored, name, render)) return undefined;
  declareReads(info, render);
  return createDirectiveAttribute(name, checked.expression, span(item));
}

/** What the module's own directive reads, its components declare as their own (ADR-0070). */
function declareReads(info: DirectiveInfo, render: ElementContext["render"]): void {
  for (const binding of info.bindings) {
    if (!render.bindings.some((each) => each.id === binding.id)) render.bindings.push(binding);
  }
}

/** The setup function a value names by itself (`v-click-outside={close}`), or `undefined`. */
function setupFunction(node: AST.Node, render: ElementContext["render"]): SetupBinding | undefined {
  if (node.type !== "Identifier" || !render.scopes.isReference(node)) return undefined;
  const resolution = render.scopes.resolve(node as AST.IdentifierReference);
  if (resolution.kind !== "variable" || resolution.scope !== render.component) return undefined;
  const binding = render.setup.bindings.get(resolution.declaration);
  return binding?.kind === "localFn" ? binding : undefined;
}

/** The components whose shadowing of a directive's name is reported, with each name. */
const shadowsReported = new WeakMap<object, Set<string>>();

/**
 * What a value built in place is, `an object literal`, or `undefined` for any other value: the
 * value itself, or what a conditional or a logical operator may give.
 */
function freshValue(node: AST.Node): string | undefined {
  switch (node.type) {
    case "ConditionalExpression":
      return freshValue(unwrapped(node.consequent)) ?? freshValue(unwrapped(node.alternate));
    case "LogicalExpression":
      return freshValue(unwrapped(node.left)) ?? freshValue(unwrapped(node.right));
    case "ObjectExpression":
      return "an object literal";
    case "ArrayExpression":
      return "an array literal";
    case "ArrowFunctionExpression":
    case "FunctionExpression":
      return "a function";
    case "NewExpression":
      return "an object";
    case "ClassExpression":
      return "a class";
    case "Literal":
      // A regular expression literal is a new object each time it runs.
      return "regex" in node && node.regex ? "a regular expression" : undefined;
    default:
      return undefined;
  }
}

/**
 * Reports a directive on what has no element of its own there (UF3056, ADR-0099): a component,
 * `<component is>` or `<Teleport>`. `v-model` is not a directive here.
 */
export function directiveOnNonElement(
  nameNode: AST.JSXIdentifier,
  what: string,
  reporter: Reporter,
): void {
  reporter.report(
    "UF3056",
    nameNode,
    `\`${nameNode.name}\` applies a directive to ${what}, which has no element of its own there: a directive's hooks run on the element it is written on.`,
    { help: "Apply the directive to an element inside it." },
  );
}

/**
 * The names of Vue's own directives, which the source language writes otherwise (`v-model`
 * excepted): an element's attribute of one is framework syntax (UF1002), and no directive takes
 * one, since Vue's template would read it as its own.
 */
const RESERVED_DIRECTIVES: ReadonlySet<string> = new Set([
  "v-bind",
  "v-cloak",
  "v-else",
  "v-else-if",
  "v-for",
  "v-html",
  "v-if",
  "v-is",
  "v-memo",
  "v-model",
  "v-on",
  "v-once",
  "v-pre",
  "v-show",
  "v-slot",
  "v-text",
]);

/**
 * Whether a JSX attribute's name applies a directive: `v-` and anything but one of Vue's own
 * (`v-model`, `v-if`, …), which are checked as the attributes they are.
 */
export function isDirectiveAttribute(name: string): boolean {
  if (!/^v-/i.test(name)) return false;
  const base = /^v-[A-Za-z0-9-]*/.exec(name)![0].toLowerCase();
  return !RESERVED_DIRECTIVES.has(base) && !/^v-model(?:$|[_:])/i.test(name);
}

/** A directive's name without its `v`, in kebab case: `focus-trap` for `vFocusTrap`. */
function kebab(name: string): string {
  return name
    .slice(1)
    .replace(/[A-Z]/g, (letter, at: number) => `${at ? "-" : ""}${letter.toLowerCase()}`);
}

/** The expression inside parentheses, `as`, `satisfies` and `!`. */
function unwrapped(node: AST.Node): AST.Node {
  let inner = node;
  while (
    inner.type === "ParenthesizedExpression" ||
    inner.type === "TSAsExpression" ||
    inner.type === "TSSatisfiesExpression" ||
    inner.type === "TSNonNullExpression"
  ) {
    inner = inner.expression;
  }
  return inner;
}
