// What a component or a hook reads of its module on React (ADR-0070): the values it imports from
// relative `.ts` modules, which its output imports from its copy of the module as the source
// does, and the module's top-level constants, which its output declares at module scope as
// written, in source order, with the types they name. The output is a module whose function holds
// the setup, as the source's is, so every name keeps its meaning: the target claims its own names
// past them (`moduleNames`).
import {
  codeKind,
  codeNames,
  parseCodeSource,
  parseExpressionSource,
  typeNames,
  typeSpecifier,
} from "@unframework/codegen";
import type { CodeKind, ImportSet } from "@unframework/codegen";
import { codeOf, functionsOf } from "@unframework/ir";
import type { BindingId, TypeDeclaration, TypeText, UfComponent, UfModule } from "@unframework/ir";

/** What an owner's output declares of its module. */
export interface ModuleReads {
  /** The constants it reaches, in source order, as written. */
  constants: string[];
  /**
   * The module's type declarations its constants name, transitively, that the owner's own types
   * leave out, to declare beside them.
   */
  types: TypeDeclaration[];
}

/**
 * The module's values an owner reads, those its constants read in turn, and those a `typeof`
 * names: in the owner's own code and types where no binding of the owner shadows the name, and in
 * the module's text the output copies (a constant, a type declaration) always. `typeTexts` adds
 * what the owner's IR does not hold: a composable's parameter types. Each value import, and each
 * type import the constants name, is added to `imports`, and each constant is declared.
 */
export function moduleReads(
  owner: UfComponent,
  module: UfModule,
  imports: ImportSet,
  typeTexts: readonly TypeText[] = [],
): ModuleReads {
  const constants = module.constants ?? [];
  const moduleValues = new Set([
    ...constants.map(({ name }) => name),
    ...(module.moduleImports ?? []).flatMap(({ names }) => names.map(({ local }) => local)),
  ]);
  const values = new Set(
    owner.bindings
      .filter((binding) => binding.kind === "import" || binding.kind === "moduleConst")
      .map((binding) => binding.name),
  );
  const query = (text: string, kind: CodeKind | "type", shadowed: ReadonlySet<string>) => {
    for (const name of typeQueries(text, kind)) {
      if (moduleValues.has(name) && !shadowed.has(name)) values.add(name);
    }
  };
  const shadowed = new Set(
    owner.bindings
      .filter(({ kind }) => kind !== "moduleConst" && kind !== "import")
      .map(({ name }) => name),
  );
  for (const { code } of codeOf(owner)) query(code.code, codeKind(code, owner), shadowed);
  for (const text of ownTypes(owner)) query(text.code, "type", shadowed);
  for (const text of typeTexts) query(text.code, "type", new Set());
  // The constants reached, what their values and types read, and the declarations those name.
  const own = new Set(owner.types);
  const named = new Set<string>();
  const declared = new Set<string>();
  for (let size = -1; size !== values.size + declared.size;) {
    size = values.size + declared.size;
    for (const constant of constants) {
      if (!values.has(constant.name)) continue;
      for (const reference of constant.value.refs) {
        if (reference.kind === "Binding") values.add(nameOf(reference.binding));
      }
      if (constant.type) {
        for (const name of typeNames(constant.type)) named.add(name);
        query(constant.type.code, "type", new Set());
      }
      for (const name of codeNames(constant.value.code)) named.add(name);
      query(constant.value.code, "expression", new Set());
    }
    for (const declaration of module.types) {
      if (own.has(declaration.name) || !named.has(declaration.name)) continue;
      declared.add(declaration.name);
      for (const name of codeNames(declaration.code, "statements")) named.add(name);
      query(declaration.code, "statements", new Set());
    }
  }
  for (const entry of module.moduleImports ?? []) {
    for (const name of entry.names) {
      if (!values.has(name.local)) continue;
      if (name.imported === "default") {
        imports.addDefault(entry.specifier, name.local, { exact: true });
      } else imports.add(entry.specifier, name.imported, { local: name.local, exact: true });
    }
  }
  // The types the constants and their declarations name, imported as the source imports them.
  for (const entry of module.typeImports ?? []) {
    for (const name of entry.names) {
      if (!named.has(name.local)) continue;
      imports.add(
        typeSpecifier(entry.specifier, module, (each) => each),
        name.imported,
        {
          type: true,
          local: name.local,
          exact: true,
        },
      );
    }
  }
  return {
    constants: constants
      .filter(({ name }) => values.has(name))
      .map(
        (constant) =>
          `const ${constant.name}${constant.type ? `: ${constant.type.code}` : ""} = ${constant.value.code};`,
      ),
    types: module.types.filter(({ name }) => declared.has(name)),
  };
}

/**
 * The type text an owner's IR writes beside its code: its props', setup's, functions' and emits'
 * types, and its type parameters'.
 */
function ownTypes(owner: UfComponent): TypeText[] {
  const found: TypeText[] = [];
  if (owner.propsParameter) found.push(owner.propsParameter.type);
  for (const prop of owner.props) found.push(prop.type);
  for (const item of owner.setup) if ("type" in item && item.type) found.push(item.type);
  for (const { function: fn } of functionsOf(owner)) {
    for (const parameter of fn.parameters) if (parameter.type) found.push(parameter.type);
    if (fn.returnType) found.push(fn.returnType);
  }
  if (owner.emits) found.push(owner.emits.type);
  for (const parameter of owner.typeParameters ?? []) {
    if (parameter.constraint) found.push(parameter.constraint);
    if (parameter.default) found.push(parameter.default);
  }
  return found;
}

/**
 * The root identifier of each `typeof` in type text or code: `SIZES` in `keyof typeof SIZES`,
 * `theme` in `typeof theme.dark`.
 */
function typeQueries(text: string, kind: CodeKind | "type"): string[] {
  let root: unknown;
  try {
    root =
      kind === "type"
        ? parseExpressionSource(`null as ${text}`).expression
        : parseCodeSource(text, kind).root;
  } catch {
    return [];
  }
  const found: string[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const each of node) visit(each);
      return;
    }
    if (!isNode(node)) return;
    if (node.type === "TSTypeQuery") {
      let name = node["exprName"];
      while (isNode(name) && name.type === "TSQualifiedName") name = name["left"];
      if (isNode(name) && name.type === "Identifier" && typeof name["name"] === "string") {
        found.push(name["name"]);
      }
    }
    for (const [key, child] of Object.entries(node)) if (key !== "parent") visit(child);
  };
  visit(root);
  return found;
}

/** Whether a value is an AST node: an object with a `type`. */
function isNode(value: unknown): value is { type: unknown; [key: string]: unknown } {
  return typeof value === "object" && value !== null && "type" in value;
}

/** The name a binding id holds, `name@offset`. */
function nameOf(id: BindingId): string {
  return id.slice(0, id.lastIndexOf("@"));
}
