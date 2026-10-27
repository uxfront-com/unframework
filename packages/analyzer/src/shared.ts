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
 * or `unframework`, UF1204).
 */
export function moduleSpecifiers(parsed: ParsedModule): string[] {
  const found = new Set<string>();
  for (const statement of parsed.program.body) {
    if (
      statement.type === "ImportDeclaration" ||
      statement.type === "ExportAllDeclaration" ||
      (statement.type === "ExportNamedDeclaration" && statement.source)
    ) {
      found.add(statement.source!.value);
    }
  }
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
 * Lowers a top-level `const` (ADR-0070): its value reads only the module's other constants, the
 * values it imports from shared modules and the pure globals, each a reference of its code. A
 * function in it may declare names of its own. Anything else it reads is reported.
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
  visit(init, (node) => {
    if (node.type !== "Identifier" || !scopes.isReference(node)) return;
    // Only a value's reference is one `resolve` knows: never a key's or a type's name.
    const resolution = scopes.resolve(node as AST.IdentifierReference);
    const at = { start: node.start, end: node.end };
    switch (resolution.kind) {
      case "global":
        if (PURE_GLOBALS.has(node.name)) {
          refs.push(createGlobalReference(node.name, at));
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
  });
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
