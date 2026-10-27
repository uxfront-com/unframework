// Shared modules and module-level declarations (ADR-0070): a component reads values and types from
// relative `.ts` modules, which the compiler copies into every output tree unchanged, and its own
// module's top-level `const` declarations. The compiler reads each shared module through its
// resolver before analysis; the analyser checks the import, and lowers each read into a binding.
import {
  bindingId,
  createBindingReference,
  createCode,
  createGlobalReference,
  createModuleConstant,
  createTypeText,
  PURE_GLOBALS,
} from "@unframework/ir";
import type { BindingId, CodeReference, ModuleConstant, Span } from "@unframework/ir";
import { visitorKeys } from "@unframework/parser";
import type { AST, ParsedModule } from "@unframework/parser";

import type { Reporter } from "./context.ts";
import {
  COLLECTION_METHODS,
  LOCALE_METHODS,
  MUTATING_METHODS,
  MUTATING_OBJECT_FUNCTIONS,
  NONDETERMINISTIC_GLOBALS,
} from "./expressions.ts";
import type { Scopes } from "./scope.ts";
import { UNKNOWN } from "./types/kinds.ts";
import type { Kinds } from "./types/kinds.ts";

/**
 * The specifier of a shared module: a relative path to a `.ts` file, written with its extension or
 * without one. Never a `.uf.ts` composable module, a `.d.ts` or another file.
 */
const SHARED_SPECIFIER = /^\.\.?\/(?:.*\/)?(?:[^/.]+|[^/]+(?<!\.uf|\.d)\.ts)$/;

/** Whether an import names a shared `.ts` module (ADR-0070). */
export function isSharedModuleSpecifier(specifier: string): boolean {
  return SHARED_SPECIFIER.test(specifier);
}

/**
 * The specifiers of the shared `.ts` modules a parsed module imports, values or types, in source
 * order, each once: what `compile()` asks its resolver to read before the module is analysed.
 */
export function sharedModuleImports(parsed: ParsedModule): string[] {
  const found = new Set<string>();
  for (const statement of parsed.program.body) {
    if (statement.type === "ImportDeclaration" && isSharedModuleSpecifier(statement.source.value)) {
      found.add(statement.source.value);
    }
  }
  return [...found];
}

/**
 * Every specifier a shared module imports or re-exports from, in source order, each once: the
 * modules the compiler follows (another relative `.ts`), allows (a package) or rejects (a framework
 * or `unframework`, UF1204). That is its `import` and `export … from` declarations, its
 * `import x = require("…")` and each `import("…")` it holds, whose module its copy loads later.
 */
export function moduleSpecifiers(parsed: ParsedModule): string[] {
  const found = new Set<string>();
  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    const typed = node as AST.Node;
    if (typeof typed.type !== "string") return;
    if (
      typed.type === "ImportDeclaration" ||
      typed.type === "ExportAllDeclaration" ||
      (typed.type === "ExportNamedDeclaration" && typed.source)
    ) {
      found.add(typed.source!.value);
    } else if (
      typed.type === "TSImportEqualsDeclaration" &&
      typed.moduleReference.type === "TSExternalModuleReference"
    ) {
      found.add(typed.moduleReference.expression.value);
    } else if (typed.type === "ImportExpression") {
      const specifier = literalString(typed.source);
      if (specifier !== undefined) found.add(specifier);
    }
    for (const key of visitorKeys[typed.type] ?? []) {
      visit((typed as unknown as Record<string, unknown>)[key]);
    }
  };
  visit(parsed.program.body);
  return [...found];
}

/**
 * What a shared module loads that the compiler cannot follow, as written, in source order: an
 * `import()` whose specifier is no string, and `import.meta.glob(…)`. Its copy would load a
 * module no output tree holds, or a framework (UF1202).
 */
export function unfollowedImports(parsed: ParsedModule): string[] {
  const found: string[] = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    const typed = node as AST.Node;
    if (typeof typed.type !== "string") return;
    if (
      (typed.type === "ImportExpression" && literalString(typed.source) === undefined) ||
      (typed.type === "MemberExpression" &&
        typed.object.type === "MetaProperty" &&
        typed.object.meta.name === "import" &&
        !typed.computed &&
        typed.property.type === "Identifier" &&
        typed.property.name.startsWith("glob"))
    ) {
      found.push(parsed.source.slice(typed.start, typed.end));
    }
    for (const key of visitorKeys[typed.type] ?? []) {
      visit((typed as unknown as Record<string, unknown>)[key]);
    }
  };
  visit(parsed.program.body);
  return found;
}

/** A shared module the source imports, as the compiler's resolver read it (ADR-0070). */
export interface SharedModule {
  /** The module's file, relative to the importer, with forward slashes. */
  file: string;
  /**
   * The first import of a framework or `unframework` the module reaches, itself or through
   * another `.ts` module it imports, with that module's file, relative to the importer (UF1204).
   */
  framework?: { specifier: string; file: string };
  /**
   * The first relative import the module reaches that the resolver could not read, or the first
   * load it cannot follow (`unfollowedImports`), as written (UF1202).
   */
  unresolved?: { specifier: string; file: string };
}

/** A value a component reads from its module (ADR-0070): an import, or a top-level `const`. */
export interface SharedValue {
  readonly kind: "import" | "moduleConst";
  readonly name: string;
  readonly id: BindingId;
  /** The identifier that declares it. */
  readonly span: Span;
  /** What reading it gives: a constant's annotation's kinds; an import is `unknown`. */
  readonly kinds: Kinds;
  /**
   * What makes a function constant's result depend on chance, the clock or the locale, itself
   * or through the module's functions it calls (UF3019): its callers' to report, as a local
   * function's is (`rules.ts`), since its body runs where they call it.
   */
  nondeterministic?: string;
}

/** What the module declares at its top level for its components to read (ADR-0070). */
export interface SharedValues {
  /** Each value import of a shared module and each top-level `const`, by its identifier. */
  readonly values: Map<object, SharedValue>;
  /**
   * The names that imports of modules the compiler could not use bind (UF1202, UF1204), by their
   * identifiers: reported at the import, so a read of one says nothing more.
   */
  readonly failed: Set<object>;
}

/** A top-level `const` the module declares, before its value is lowered. */
export interface ConstantCandidate {
  readonly statement: AST.VariableDeclaration;
  readonly declarator: AST.VariableDeclarator & { id: AST.BindingIdentifier; init: AST.Expression };
}

/** What lowering a module's constants needs. */
export interface ConstantContext {
  readonly source: string;
  readonly scopes: Scopes;
  readonly reporter: Reporter;
  readonly shared: SharedValues;
}

/**
 * Lowers the module's top-level `const`s (ADR-0070): plain values, which the module computes in
 * order as it loads, on the server too, and which nothing changes. Each value is either a
 * function, `const format = (…) => …`, whose body runs when it is called, or any other value,
 * all of which runs as the module loads, the functions in it included, since what it passes
 * them to may call them then.
 *
 * - A value reads only the module's other constants, the values it imports from shared modules
 *   and the pure globals (UF3020), each a reference of its code. As the module loads, it reads
 *   no constant declared after it, itself or through the functions it calls (UF2023).
 * - Nothing in it changes a value in place (UF2004): no member is written or deleted, and no
 *   mutating method is called, whatever the receiver. A function writes only its own locals
 *   (UF2011).
 * - It holds no JSX (UF3012), and no `this`, `import.meta`, `import()`, function expression or
 *   class (UF1002). A computed member it calls, or reads off `Math`, is named (UF1002).
 * - What reads chance, the clock or the locale is UF3019 as the module loads. In a function it
 *   marks the constant `nondeterministic`, which a template, a getter or an initial value that
 *   calls it reports, as setup does (`rules.ts`).
 */
export function lowerConstants(
  candidates: readonly ConstantCandidate[],
  context: ConstantContext,
): ModuleConstant[] {
  const { source, scopes, reporter, shared } = context;
  /** The constants each constant reads or calls, by its binding id, for UF2023. */
  const reads = new Map<BindingId, Set<SharedValue>>();
  /** The calls of the module's constants each value makes as the module loads. */
  const loadCalls: { caller: SharedValue; callee: SharedValue; at: AST.Node }[] = [];
  /** Where each value reads a constant as the module loads: direct reads, for UF2023. */
  const loadReads: { caller: SharedValue; read: SharedValue; at: AST.Node }[] = [];
  /** Each function constant's own nondeterminism: called later, it is its callers' to report. */
  const reasons = new Map<BindingId, string>();
  const lowered = candidates.map(({ statement, declarator }) => {
    const { id, init } = declarator;
    const own = shared.values.get(id)!;
    const deferred = init.type === "ArrowFunctionExpression";
    const refs: CodeReference[] = [];
    const read = new Set<SharedValue>();
    reads.set(own.id, read);
    /** `reason` is "`Date` reads the clock": what, then how, as setup's walk words it. */
    const nondeterminism = (node: AST.Node, reason: string) => {
      if (deferred) {
        const at = reason.indexOf("` ") + 1;
        if (!reasons.has(own.id)) {
          reasons.set(own.id, `${reason.slice(at + 1)} (${reason.slice(0, at)})`);
        }
        return;
      }
      reporter.report(
        "UF3019",
        node,
        `${reason}, and the module computes \`${id.name}\` as it loads, on the server too: the server's render and the browser's would differ.`,
        { help: "Pass the value in as a prop, or set it from a component's client code." },
      );
    };
    const inPlace = (at: AST.Node, how: string) =>
      reporter.report(
        "UF2004",
        at,
        `${how} a value in place, in \`${id.name}\`: a module's values are plain and read-only (ADR-0070), so nothing changes them, and state shared between a component's instances has no form.`,
        {
          help: "Build a new value instead (`[...items, item]`, `{ ...table, key }`, `toSorted`, `new Map([...entries])`), or keep what changes in a `ref` of a component's setup.",
        },
      );
    /** A write's target: a function's own local, or else nothing the module may change. */
    const target = (node: AST.Node, at: AST.Node, how: string): void => {
      const inner = unwrapped(node);
      switch (inner.type) {
        case "Identifier": {
          const resolution = scopes.resolve(inner as AST.IdentifierReference);
          const local =
            resolution.kind === "parameter" ||
            (resolution.kind === "variable" && (resolution.scope as AST.Node).type !== "Program");
          if (local) return;
          reporter.report(
            "UF2011",
            at,
            `\`${inner.name}\` is written in \`${id.name}\`: a module's values are read-only (ADR-0070), and a function of the module writes only its own locals.`,
            { help: "Keep what changes in a `ref` of a component's setup." },
          );
          return;
        }
        case "ObjectPattern":
          for (const property of inner.properties) {
            target(property.type === "RestElement" ? property.argument : property.value, at, how);
          }
          return;
        case "ArrayPattern":
          for (const element of inner.elements) if (element) target(element, at, how);
          return;
        case "AssignmentPattern":
          target(inner.left, at, how);
          return;
        case "RestElement":
          target(inner.argument, at, how);
          return;
        default:
          inPlace(at, how);
      }
    };
    const walk = (node: unknown, load: boolean): void => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) {
        for (const item of node) walk(item, load);
        return;
      }
      const typed = node as AST.Node;
      if (typeof typed.type !== "string") return;
      // A type is erased: what it names is never read (`typeof B`).
      if (typed.type.startsWith("TS") && !TYPE_WRAPPERS.has(typed.type)) return;
      switch (typed.type) {
        case "JSXElement":
        case "JSXFragment":
          reporter.report(
            "UF3012",
            typed,
            `\`${id.name}\` holds JSX, and JSX can only be in a component's template: the tree the component returns, and its slot functions.`,
            { help: "Write the JSX in the template, or extract a component." },
          );
          return;
        case "MetaProperty":
        case "ImportExpression":
        case "ThisExpression":
        case "FunctionExpression":
        case "ClassExpression":
        case "Super":
          reporter.unsupported(typed, UNSUPPORTED[typed.type]!(id.name));
          return;
        case "ArrowFunctionExpression":
          // The value's own function runs when it is called; any other runs as the module loads.
          walkChildren(typed, typed === init ? false : load);
          return;
        case "AssignmentExpression":
          target(typed.left, typed, "An assignment changes");
          walk(typed.right, load);
          // A pattern's defaults and a member's object are read.
          walkTargetReads(typed.left, load);
          return;
        case "UpdateExpression":
          target(typed.argument, typed, `\`${typed.operator}\` changes`);
          walkTargetReads(typed.argument, load);
          return;
        case "ForInStatement":
        case "ForOfStatement":
          if (typed.left.type !== "VariableDeclaration") {
            target(typed.left, typed.left, "A loop's target changes");
            walkTargetReads(typed.left, load);
          } else {
            walk(typed.left, load);
          }
          walk(typed.right, load);
          walk(typed.body, load);
          return;
        case "UnaryExpression":
          if (typed.operator === "delete") inPlace(typed, "`delete` changes");
          break;
        case "CallExpression": {
          const callee = unwrapped(typed.callee);
          if (callee.type === "MemberExpression") {
            const name = memberName(callee);
            if (name === undefined) {
              // A computed member of `Math` is reported where it is read.
              if (!isGlobal(unwrapped(callee.object), "Math")) {
                reporter.unsupported(
                  callee,
                  `\`${id.name}\` calls a computed member: a module's constant names the method it calls.`,
                );
              }
            } else if (MUTATING_METHODS.has(name) || COLLECTION_METHODS.has(name)) {
              inPlace(typed, `\`${name}\` changes`);
            } else if (
              MUTATING_OBJECT_FUNCTIONS.has(name) &&
              isGlobal(unwrapped(callee.object), "Object")
            ) {
              inPlace(typed, `\`Object.${name}\` changes`);
            }
          } else if (callee.type === "Identifier" && load && scopes.isReference(callee)) {
            const value = moduleValue(callee as AST.IdentifierReference);
            if (value?.kind === "moduleConst") {
              loadCalls.push({ caller: own, callee: value, at: callee });
            }
          } else if (callee.type === "ArrowFunctionExpression") {
            // Called where it is written: its body runs now.
            walkChildren(callee, load);
            walk(typed.arguments, load);
            return;
          }
          break;
        }
        case "MemberExpression": {
          const name = memberName(typed);
          const object = unwrapped(typed.object);
          if (isGlobal(object, "Math")) {
            if (name === undefined) {
              reporter.unsupported(
                typed,
                `\`${id.name}\` reads a computed member of \`Math\`: a module's constant names it.`,
              );
            } else if (name === "random") {
              nondeterminism(typed, "`Math.random` reads chance");
            }
          } else if (name !== undefined && LOCALE_METHODS.has(name)) {
            nondeterminism(typed.property, `\`${name}\` formats by the machine's locale`);
          }
          break;
        }
        case "Identifier":
          if (scopes.isReference(typed)) reference(typed as AST.IdentifierReference, load);
          return;
      }
      walkChildren(typed, load);
    };
    const walkChildren = (node: AST.Node, load: boolean) => {
      for (const key of visitorKeys[node.type] ?? []) {
        walk((node as unknown as Record<string, unknown>)[key], load);
      }
    };
    /** What a write's target reads: a member's object and computed key, a pattern's defaults. */
    const walkTargetReads = (node: AST.Node, load: boolean): void => {
      const inner = unwrapped(node);
      switch (inner.type) {
        case "Identifier":
          return;
        case "ObjectPattern":
          for (const property of inner.properties) {
            if (property.type === "RestElement") walkTargetReads(property.argument, load);
            else {
              if (property.computed) walk(property.key, load);
              walkTargetReads(property.value, load);
            }
          }
          return;
        case "ArrayPattern":
          for (const element of inner.elements) if (element) walkTargetReads(element, load);
          return;
        case "AssignmentPattern":
          walkTargetReads(inner.left, load);
          walk(inner.right, load);
          return;
        case "RestElement":
          walkTargetReads(inner.argument, load);
          return;
        default:
          walk(inner, load);
      }
    };
    const reference = (node: AST.IdentifierReference, load: boolean) => {
      const resolution = scopes.resolve(node);
      const at = { start: node.start, end: node.end };
      switch (resolution.kind) {
        case "global": {
          const reason = NONDETERMINISTIC_GLOBALS.get(node.name);
          if (PURE_GLOBALS.has(node.name)) {
            refs.push(createGlobalReference(node.name, at));
          } else if (reason) {
            nondeterminism(node, reason);
          } else {
            reporter.report(
              "UF3020",
              node,
              `\`${node.name}\` is not a constant the module declares, a value it imports from a shared module, or a global a module's constant can read: the module computes its constants as it loads, on the server too.`,
              {
                help: "Read it in a component's client code, or check its spelling. A module's constant reads pure globals such as `Math` and `String`.",
              },
            );
          }
          return;
        }
        case "variable":
        case "import": {
          // A name the value declares itself, a function's parameter or local, is its own.
          if (resolution.kind === "variable" && (resolution.scope as AST.Node).type !== "Program") {
            return;
          }
          const value = shared.values.get(resolution.declaration);
          if (value === own) {
            reporter.unsupported(
              node,
              `\`${node.name}\` reads itself: a module's constant is a plain value, and a function that calls itself is declared in a shared \`.ts\` module.`,
            );
          } else if (value) {
            refs.push(createBindingReference(value.id, at));
            if (value.kind === "moduleConst") {
              read.add(value);
              if (load) loadReads.push({ caller: own, read: value, at: node });
            }
          } else if (!shared.failed.has(resolution.declaration)) {
            reporter.unsupported(
              node,
              `\`${node.name}\` is not a constant the module declares, or a value it imports from a shared module: a module's constant reads only those, and pure globals.`,
            );
          }
          return;
        }
        default:
          return;
      }
    };
    walk(init, true);
    refs.sort((a, b) => a.span.start - b.span.start);
    const annotation = id.typeAnnotation?.typeAnnotation;
    return createModuleConstant(
      id.name,
      own.id,
      createCode(source.slice(init.start, init.end), { start: init.start, end: init.end }, refs),
      { start: statement.start, end: statement.end },
      annotation
        ? createTypeText(source.slice(annotation.start, annotation.end), {
            start: annotation.start,
            end: annotation.end,
          })
        : undefined,
    );
  });
  /** The constants a constant reads, itself and through every constant it reads in turn. */
  const reached = (from: SharedValue): Set<SharedValue> => {
    const found = new Set<SharedValue>();
    const pending = [...(reads.get(from.id) ?? [])];
    while (pending.length) {
      const next = pending.pop()!;
      if (found.has(next)) continue;
      found.add(next);
      pending.push(...(reads.get(next.id) ?? []));
    }
    return found;
  };
  // UF2023: as the module loads, a value reads only what is declared before it, itself or
  // through what the functions it calls read (setup's rule, ADR-0045).
  for (const { caller, read, at } of loadReads) {
    if (read.span.start > caller.span.start) {
      reporter.report(
        "UF2023",
        at,
        `\`${read.name}\` is declared after \`${caller.name}\`, whose value reads it as the module loads: it throws a \`ReferenceError\` there.`,
        { help: `Declare \`${read.name}\` before \`${caller.name}\`.` },
      );
    }
  }
  for (const { caller, callee, at } of loadCalls) {
    const later = [callee, ...reached(callee)].find(
      (value) => value.kind === "moduleConst" && value.span.start > caller.span.start,
    );
    if (later && later !== callee) {
      reporter.report(
        "UF2023",
        at,
        `\`${callee.name}\` reads \`${later.name}\`, which is declared after \`${caller.name}\`, whose value calls it as the module loads: it throws a \`ReferenceError\` there.`,
        { help: `Declare \`${later.name}\` before \`${caller.name}\`.` },
      );
    }
    const reason = [callee, ...reached(callee)]
      .map((value) => reasons.get(value.id))
      .find((each) => each !== undefined);
    if (reason) {
      reporter.report(
        "UF3019",
        at,
        `\`${callee.name}\` ${reason}, and the module calls it as it loads, computing \`${caller.name}\`, on the server too: the server's render and the browser's would differ.`,
        { help: "Pass the value in as a prop, or set it from a component's client code." },
      );
    }
  }
  // What a function reads of chance, the clock or the locale, itself or through the module's
  // functions it calls, is its callers' to report (`rules.ts`), as a local function's is.
  for (const value of shared.values.values()) {
    if (value.kind !== "moduleConst") continue;
    const reason = [value, ...reached(value)]
      .map((each) => reasons.get(each.id))
      .find((each) => each !== undefined);
    if (reason) value.nondeterministic = reason;
  }
  return lowered;

  function moduleValue(node: AST.IdentifierReference): SharedValue | undefined {
    const resolution = scopes.resolve(node);
    if (resolution.kind === "import") return shared.values.get(resolution.declaration);
    return resolution.kind === "variable" && (resolution.scope as AST.Node).type === "Program"
      ? shared.values.get(resolution.declaration)
      : undefined;
  }

  function isGlobal(node: AST.Node, name: string): boolean {
    return (
      node.type === "Identifier" &&
      node.name === name &&
      scopes.isReference(node) &&
      scopes.resolve(node as AST.IdentifierReference).kind === "global"
    );
  }
}

/** The TypeScript nodes that wrap an expression, which is read: any other is a type. */
const TYPE_WRAPPERS: ReadonlySet<string> = new Set([
  "TSAsExpression",
  "TSSatisfiesExpression",
  "TSNonNullExpression",
  "TSTypeAssertion",
  "TSInstantiationExpression",
]);

/** Why each construct a module's constant may not hold is unsupported, by node type. */
const UNSUPPORTED: Readonly<Record<string, (name: string) => string>> = {
  MetaProperty: (name) =>
    `\`${name}\` reads the module's meta property, which a module's constant does not.`,
  ImportExpression: () =>
    "Dynamic imports are not supported: a module imports a shared module's values with an `import` declaration.",
  ThisExpression: (name) => `\`${name}\` reads \`this\`, which a module's constant does not.`,
  FunctionExpression: (name) =>
    `\`${name}\` holds a function expression: write a module's function as an arrow function.`,
  ClassExpression: (name) => `\`${name}\` holds a class, which a module's constant does not.`,
  Super: (name) => `\`${name}\` reads \`super\`, which a module's constant does not.`,
};

/** An expression without the parentheses and the type assertions around it. */
function unwrapped(node: AST.Node): AST.Node {
  let inner = node;
  while (TYPE_WRAPPERS.has(inner.type) || inner.type === "ParenthesizedExpression") {
    inner = (inner as unknown as { expression: AST.Node }).expression;
  }
  return inner;
}

/** A member's name: a static one, or a computed string literal or template without holes. */
function memberName(node: AST.MemberExpression): string | undefined {
  const { property } = node;
  if (!node.computed) return property.type === "Identifier" ? property.name : undefined;
  return literalString(property);
}

/** A string literal's value, or a template literal's without holes. */
export function literalString(node: AST.Node): string | undefined {
  if (node.type === "Literal") return typeof node.value === "string" ? node.value : undefined;
  if (node.type === "TemplateLiteral" && !node.expressions.length) {
    return node.quasis[0]?.value.cooked ?? undefined;
  }
  return undefined;
}

/** A shared value, declared by its identifier. */
export function sharedValue(
  kind: SharedValue["kind"],
  id: { name: string; start: number; end: number },
  kinds: Kinds = UNKNOWN,
): SharedValue {
  return {
    kind,
    name: id.name,
    id: bindingId(id.name, id.start),
    span: { start: id.start, end: id.end },
    kinds,
  };
}
