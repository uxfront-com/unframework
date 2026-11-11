// What a component or a composable reads of its module on Astro (ADR-0070): the values it
// imports from relative `.ts` modules, which its output imports from its copy of the module as
// the source does, and the module's top-level constants, which its output declares as written.
// Only those the server render reaches are kept, as with the setup (`./setup.ts`): a value only
// client code reads would be unused (L5). A component's frontmatter is one scope with its
// setup, so a module name that a top-level name of the component shadows, and that it reaches
// only through a constant, is declared under a name of its own.
import {
  codeNames,
  parseCodeSource,
  parseExpressionSource,
  typeNames,
} from "@unframework.dev/codegen";
import type { CodeKind, ImportSet, NameScope } from "@unframework.dev/codegen";
import type {
  BindingId,
  Code,
  ModuleConstant,
  TypeDeclaration,
  UfComponent,
  UfModule,
} from "@unframework.dev/ir";

/** What an owner's output declares of its module. */
export interface ModuleReads {
  /** The constants, in source order, each as written but for the module names it reads. */
  constants: string[];
  /**
   * The module's type declarations its constants name, transitively, that the owner's own types
   * leave out, to declare beside them.
   */
  types: TypeDeclaration[];
  /** Rewrites the `typeof` of a module name declared under another name in copied type text. */
  renamed: (text: string, kind: CodeKind | "type") => string;
}

/**
 * The module's values an owner reaches, given what its server render reads (`live`, of its
 * `serverView`, whose walk reaches the constants a constant reads): each value import is added
 * to `imports`, and each constant is declared, in source order. A name the owner reads itself
 * is spelled by `local`; one it reaches only through a constant takes another name where `scope`
 * has it taken already, by a top-level name of the output. Each is then taken in `scope`.
 */
export function moduleReads(
  owner: UfComponent,
  module: UfModule,
  live: ReadonlySet<BindingId>,
  {
    imports,
    scope,
    local,
  }: {
    imports: ImportSet;
    scope: NameScope;
    local: (id: BindingId) => string;
  },
): ModuleReads {
  const constants = (module.constants ?? []).filter(({ binding }) => live.has(binding));
  // An imported value is read by an `import` binding of its local name: the owner's own, or one
  // a reached constant's value reads.
  const importIds = new Set<BindingId>(
    owner.bindings.filter(({ kind }) => kind === "import").map(({ id }) => id),
  );
  const constantIds = new Set((module.constants ?? []).map(({ binding }) => binding));
  for (const constant of constants) {
    for (const reference of constant.value.refs) {
      if (reference.kind === "Binding" && !constantIds.has(reference.binding)) {
        importIds.add(reference.binding);
      }
    }
  }
  const imported = new Set([...importIds].filter((id) => live.has(id)).map((id) => nameOf(id)));
  const reached = [...constants.map(({ name }) => name), ...imported];
  // A name the owner reads itself is no top-level name of its own: no binding shadows it.
  const read = new Map(
    owner.bindings
      .filter(({ kind }) => kind === "moduleConst" || kind === "import")
      .map(({ id, name }) => [name, id] as const),
  );
  const locals = new Map<string, string>();
  for (const name of reached) {
    const id = read.get(name);
    locals.set(name, id ? local(id) : scope.has(name) ? scope.claim(name) : name);
  }
  scope.reserve(...locals.values());
  for (const entry of module.moduleImports ?? []) {
    for (const name of entry.names) {
      if (!imported.has(name.local)) continue;
      const as = locals.get(name.local)!;
      if (name.imported === "default") imports.addDefault(entry.specifier, as, { exact: true });
      else imports.add(entry.specifier, name.imported, { local: as, exact: true });
    }
  }
  const renamed = (text: string, kind: CodeKind | "type") => renamedQueries(text, kind, locals);
  return {
    constants: constants.map((constant) => {
      const type = constant.type ? `: ${renamed(constant.type.code, "type")}` : "";
      return `const ${locals.get(constant.name)}${type} = ${renamedValue(constant.value, locals)};`;
    }),
    types: constantTypes(owner, module, constants),
    renamed,
  };
}

/**
 * The module's type declarations the constants name (ADR-0070): those their annotations and
 * values read, and those these declarations read in turn, beyond the owner's own.
 */
function constantTypes(
  owner: UfComponent,
  module: UfModule,
  constants: readonly ModuleConstant[],
): TypeDeclaration[] {
  const read = new Set<string>();
  for (const constant of constants) {
    if (constant.type) for (const name of typeNames(constant.type)) read.add(name);
    for (const name of codeNames(constant.value.code)) read.add(name);
  }
  const own = new Set(owner.types);
  const found = new Set<string>();
  for (let size = -1; size !== found.size;) {
    size = found.size;
    for (const declaration of module.types) {
      if (own.has(declaration.name) || found.has(declaration.name)) continue;
      if (!read.has(declaration.name)) continue;
      found.add(declaration.name);
      for (const name of codeNames(declaration.code, "statements")) read.add(name);
    }
  }
  return module.types.filter(({ name }) => found.has(name));
}

/**
 * A constant's value with each module name it reads written as the output declares it, a
 * shorthand property expanded (`{ LIMITS: LIMITS_1 }`), and each `typeof` of one too.
 */
function renamedValue(value: Code, locals: ReadonlyMap<string, string>): string {
  const edits: Edit[] = [];
  let shorthand: ReadonlySet<number> | undefined;
  for (const reference of value.refs) {
    if (reference.kind !== "Binding") continue;
    const name = nameOf(reference.binding);
    const local = locals.get(name) ?? name;
    if (local === name) continue;
    const start = reference.span.start - value.span.start;
    shorthand ??= shorthandValues(value.code);
    const key = reference.shorthand || shorthand.has(start) ? `${name}: ` : "";
    edits.push({ start, end: reference.span.end - value.span.start, text: `${key}${local}` });
  }
  for (const { name, start, end } of typeQueries(value.code, "expression")) {
    const local = locals.get(name) ?? name;
    if (local !== name) edits.push({ start, end, text: local });
  }
  return applied(value.code, edits);
}

/** Type text or code with each module name a `typeof` queries written as declared. */
function renamedQueries(
  text: string,
  kind: CodeKind | "type",
  locals: ReadonlyMap<string, string>,
): string {
  if (![...locals].some(([name, local]) => name !== local)) return text;
  const edits = typeQueries(text, kind).flatMap(({ name, start, end }) => {
    const local = locals.get(name) ?? name;
    return local === name ? [] : [{ start, end, text: local }];
  });
  return applied(text, edits);
}

interface Edit {
  start: number;
  end: number;
  text: string;
}

function applied(text: string, edits: readonly Edit[]): string {
  let written = "";
  let last = 0;
  for (const edit of edits.toSorted((a, b) => a.start - b.start)) {
    written += `${text.slice(last, edit.start)}${edit.text}`;
    last = edit.end;
  }
  return `${written}${text.slice(last)}`;
}

/** A node of oxc's AST, as far as these walks read it. */
interface AstNode {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

/** Calls `visit` on every node of a tree, parents first. */
function visit(root: unknown, each: (node: AstNode) => void): void {
  if (Array.isArray(root)) {
    for (const item of root) visit(item, each);
    return;
  }
  if (!root || typeof root !== "object" || typeof (root as AstNode).type !== "string") return;
  each(root as AstNode);
  for (const [key, value] of Object.entries(root)) {
    if (key !== "parent" && typeof value === "object") visit(value, each);
  }
}

/**
 * The root identifier of each `typeof` in type text or code, with its offsets: `SIZES` in
 * `keyof typeof SIZES`, `theme` in `typeof theme.dark`.
 */
function typeQueries(
  text: string,
  kind: CodeKind | "type",
): { name: string; start: number; end: number }[] {
  // Type text parses as the type of an assertion, whose offsets the prefix shifts.
  const prefix = kind === "type" ? "null as " : "";
  const root =
    kind === "type"
      ? parseExpressionSource(`${prefix}${text}`).expression
      : parseCodeSource(text, kind).root;
  const found: { name: string; start: number; end: number }[] = [];
  visit(root, (node) => {
    if (node.type !== "TSTypeQuery") return;
    let name = node["exprName"] as AstNode | undefined;
    while (name?.type === "TSQualifiedName") name = name["left"] as AstNode;
    if (name?.type === "Identifier" && typeof name["name"] === "string") {
      found.push({
        name: name["name"],
        start: name.start - prefix.length,
        end: name.end - prefix.length,
      });
    }
  });
  return found;
}

/**
 * Where an expression's shorthand properties' values start (`{ LIMITS }`): a constant's
 * references carry no `shorthand` mark, so the code says.
 */
function shorthandValues(code: string): Set<number> {
  const found = new Set<number>();
  visit(parseExpressionSource(code).expression, (node) => {
    const value = node["value"] as AstNode | undefined;
    if (node.type === "Property" && node["shorthand"] === true && value) found.add(value.start);
  });
  return found;
}

/** The name of a binding id, `name@offset`. */
function nameOf(id: BindingId): string {
  return id.slice(0, id.lastIndexOf("@"));
}
