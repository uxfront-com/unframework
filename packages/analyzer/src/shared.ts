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
    } else if (
      typed.type === "ImportExpression" &&
      typed.source.type === "Literal" &&
      typeof typed.source.value === "string"
    ) {
      found.add(typed.source.value);
    }
    for (const key of visitorKeys[typed.type] ?? []) {
      visit((typed as unknown as Record<string, unknown>)[key]);
    }
  };
  visit(parsed.program.body);
  return [...found];
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
  /** The first relative import the module reaches that the resolver could not read (UF1202). */
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
 * Lowers a top-level `const` (ADR-0070): a plain value, which the module computes as it loads, on
 * the server too, and which no code changes. Its value reads only the module's other constants,
 * the values it imports from shared modules and the pure globals, each a reference of its code,
 * and outside a function only the constants declared before it, which the module has computed by
 * then (UF2023). A function in it may declare names of its own. Like setup code, it holds no JSX
 * (UF3012), reads no chance, clock or locale (UF3019), no `import.meta` and no `import()` (UF1002),
 * and never writes a module's value, or changes one in place (UF2011, UF2004).
 */
export function lowerConstant(
  candidate: ConstantCandidate,
  context: ConstantContext,
): ModuleConstant {
  const { statement, declarator } = candidate;
  const { id, init } = declarator;
  const { source, scopes, reporter, shared } = context;
  const own = shared.values.get(id)!;
  const refs: CodeReference[] = [];
  /** The module value a name reads, or `undefined` for a name the value declares, or a global. */
  const moduleValue = (node: AST.IdentifierReference) => {
    const resolution = scopes.resolve(node);
    if (resolution.kind === "import") return shared.values.get(resolution.declaration);
    return resolution.kind === "variable" && (resolution.scope as AST.Node).type === "Program"
      ? shared.values.get(resolution.declaration)
      : undefined;
  };
  /**
   * Reports a write whose target's root is a module's value, or a call that changes it in place
   * (`inPlace`): read-only (ADR-0070).
   */
  const write = (target: AST.Node, at: AST.Node, how: string, inPlace = false) => {
    let root: AST.Node = target;
    while (root.type === "MemberExpression") root = root.object;
    if (root.type !== "Identifier" || !scopes.isReference(root)) return;
    const value = moduleValue(root as AST.IdentifierReference);
    if (!value) return;
    const what = `\`${value.name}\`, ${value.kind === "import" ? "a value imported from a `.ts` module" : "a constant the module declares"}`;
    if (target === root && !inPlace) {
      reporter.report(
        "UF2011",
        at,
        `${what}, is written: a module's values are read-only (ADR-0070), so state shared between a component's instances has no form.`,
        { help: "Keep what changes in a `ref` of a component's setup." },
      );
    } else {
      reporter.report(
        "UF2004",
        at,
        `${how} ${what}, in place: a module's values are read-only (ADR-0070), so state shared between a component's instances has no form.`,
        { help: "Keep what changes in a `ref` of a component's setup, and replace it whole." },
      );
    }
  };
  const chance = (node: AST.Node, reason: string) =>
    reporter.report(
      "UF3019",
      node,
      `${reason}, and the module computes its constants as it loads, on the server too: the server's render and the browser's would differ.`,
      { help: "Pass the value in as a prop, or set it from a component's client code." },
    );
  const walk = (node: unknown, inFunction: boolean): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, inFunction);
      return;
    }
    const typed = node as AST.Node;
    if (typeof typed.type !== "string") return;
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
        reporter.unsupported(
          typed,
          `\`${typed.meta.name}.${typed.property.name}\` is not supported in a module's constant.`,
        );
        return;
      case "ImportExpression":
        reporter.unsupported(
          typed,
          "Dynamic imports are not supported: a module imports a shared module's values with an `import` declaration.",
        );
        return;
      case "ArrowFunctionExpression":
      case "FunctionExpression":
        for (const key of visitorKeys[typed.type] ?? []) {
          walk((typed as unknown as Record<string, unknown>)[key], true);
        }
        return;
      case "AssignmentExpression":
        write(typed.left, typed, "An assignment changes");
        break;
      case "UpdateExpression":
        write(typed.argument, typed, `\`${typed.operator}\` changes`);
        break;
      case "UnaryExpression":
        if (typed.operator === "delete") write(typed.argument, typed, "`delete` changes");
        break;
      case "CallExpression": {
        const { callee } = typed;
        if (callee.type !== "MemberExpression" || callee.computed) break;
        const name = callee.property.type === "Identifier" ? callee.property.name : undefined;
        if (name === undefined) break;
        const object = callee.object;
        if (
          object.type === "Identifier" &&
          object.name === "Object" &&
          MUTATING_OBJECT_FUNCTIONS.has(name) &&
          scopes.resolve(object).kind === "global"
        ) {
          const [target] = typed.arguments;
          if (target && target.type !== "SpreadElement") {
            write(target, typed, `\`Object.${name}\` changes`, true);
          }
        } else if (MUTATING_METHODS.has(name) || COLLECTION_METHODS.has(name)) {
          write(object, typed, `\`${name}\` changes`, true);
        }
        break;
      }
      case "MemberExpression": {
        const { object, property } = typed;
        if (typed.computed || property.type !== "Identifier") break;
        if (
          property.name === "random" &&
          object.type === "Identifier" &&
          object.name === "Math" &&
          scopes.resolve(object).kind === "global"
        ) {
          chance(typed, "`Math.random` reads chance");
        } else if (LOCALE_METHODS.has(property.name)) {
          chance(property, `\`${property.name}\` formats by the machine's locale`);
        }
        break;
      }
      case "Identifier":
        if (scopes.isReference(typed)) read(typed as AST.IdentifierReference, inFunction);
        return;
    }
    for (const key of visitorKeys[typed.type] ?? []) {
      walk((typed as unknown as Record<string, unknown>)[key], inFunction);
    }
  };
  const read = (node: AST.IdentifierReference, inFunction: boolean) => {
    const resolution = scopes.resolve(node);
    const at = { start: node.start, end: node.end };
    switch (resolution.kind) {
      case "global": {
        const reason = NONDETERMINISTIC_GLOBALS.get(node.name);
        if (PURE_GLOBALS.has(node.name)) {
          refs.push(createGlobalReference(node.name, at));
        } else if (reason) {
          chance(node, reason);
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
        } else if (value?.kind === "moduleConst" && !inFunction && value.span.start > id.start) {
          // The module computes its constants in order: one not computed yet throws a
          // `ReferenceError`. Imports are hoisted, and a function reads it once called.
          reporter.report(
            "UF2023",
            node,
            `\`${node.name}\` is declared after \`${id.name}\`, whose value reads it as the module loads: it throws a \`ReferenceError\` there.`,
            { help: `Declare \`${node.name}\` before \`${id.name}\`.` },
          );
        } else if (value) {
          refs.push(createBindingReference(value.id, at));
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
  walk(init, false);
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
