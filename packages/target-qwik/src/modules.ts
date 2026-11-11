// What a component or a hook reads of its module on Qwik (ADR-0070): the values it imports from
// relative `.ts` modules, which its output imports from its copy of the module as the source
// does, and the module's top-level constants, which its output declares at module scope as
// written, in source order, with the types they name. A `$` scope reads either as a module-level
// binding, which the optimizer imports into the segment it writes, so neither is captured.
import {
  codeKind,
  codeNames,
  componentTypes,
  keyOwner,
  parseCodeSource,
  parseExpressionSource,
  typeNames,
  typeSpecifier,
} from "@unframework.dev/codegen";
import type { CodeKind, ImportSet } from "@unframework.dev/codegen";
import { codeOf } from "@unframework.dev/ir";
import type {
  BindingId,
  TypeDeclaration,
  TypeText,
  UfComponent,
  UfComposable,
  UfModule,
} from "@unframework.dev/ir";

import { setupOwner } from "./composable.ts";

/** What an owner's output declares of its module (ADR-0070). */
export interface ModuleReads {
  /**
   * The constants it declares, in source order, as written, and the `export { … }` of what its
   * siblings import from it.
   */
  constants: string[];
  /** The module's type declarations its constants name, transitively, beyond its own types. */
  types: TypeDeclaration[];
}

/**
 * What a component or a composable reads of its module (ADR-0070), added to its output: each
 * imported value it reaches, imported as the source imports it, and each constant it reaches,
 * declared as written, with the module's types and the type imports their annotations name.
 *
 * A source's outputs load as one module, the files joined in source order (ADR-0053), where a
 * name may be declared once. So where a module has several owners (its components, or a `.uf.ts`
 * module's composables), its main owner (`moduleMain`) declares every module value any of them
 * reaches and exports those the others read, `export { STEP };`, and every other owner imports
 * what it reads from the main one's output, `import { STEP } from "./Pair"`, as a sibling's key
 * is (ADR-0054). The others run nothing of the module as they load (`importsModuleValues`).
 */
export function moduleReads(name: string, module: UfModule, imports: ImportSet): ModuleReads {
  if (!moduleValueNames(module).length) return { constants: [], types: [] };
  const owners = [
    ...module.components.map((component) => ({ owner: component, typeTexts: [] as TypeText[] })),
    ...(module.composables ?? []).map((composable) => ({
      owner: setupOwner(composable),
      typeTexts: composableTypeTexts(composable),
    })),
  ];
  const own = owners.find(({ owner }) => owner.name === name)!;
  const direct = ownValues(own.owner, module, own.typeTexts);
  if (importsModuleValues(module, name)) {
    const main = moduleMain(module)!;
    for (const value of [...direct].toSorted()) imports.add(`./${main}`, value, { exact: true });
    return { constants: [], types: [] };
  }
  // The main owner declares what every owner reaches, and exports what the others read.
  const exported = new Set<string>();
  const values = new Set(direct);
  for (const each of owners) {
    if (each === own) continue;
    for (const value of ownValues(each.owner, module, each.typeTexts)) {
      exported.add(value);
      values.add(value);
    }
  }
  const closed = closure(values, own.owner, module);
  for (const entry of module.moduleImports ?? []) {
    for (const each of entry.names) {
      if (!closed.values.has(each.local)) continue;
      if (each.imported === "default") {
        imports.addDefault(entry.specifier, each.local, { exact: true });
      } else imports.add(entry.specifier, each.imported, { local: each.local, exact: true });
    }
  }
  for (const entry of module.typeImports ?? []) {
    for (const each of entry.names) {
      if (!closed.named.has(each.local)) continue;
      imports.add(
        typeSpecifier(entry.specifier, module, (specifier) => specifier),
        each.imported,
        {
          type: true,
          local: each.local,
          exact: true,
        },
      );
    }
  }
  const constants = (module.constants ?? []).filter((constant) => closed.values.has(constant.name));
  return {
    constants: [
      ...constants.map(
        (constant) =>
          `const ${constant.name}${constant.type ? `: ${constant.type.code}` : ""} = ${constant.value.code};`,
      ),
      ...(exported.size ? [`export { ${[...exported].toSorted().join(", ")} };`] : []),
    ],
    types: module.types.filter((declaration) => closed.types.has(declaration.name)),
  };
}

/**
 * Whether an owner imports its module's values from its main owner's output (see
 * {@link moduleReads}): it then reads them only inside its function, never at module scope, where
 * the import between the files may not have run yet.
 */
export function importsModuleValues(module: UfModule, name: string): boolean {
  return (
    module.components.length + (module.composables?.length ?? 0) > 1 && moduleMain(module) !== name
  );
}

/** The owner whose output declares the module's values: its main component, or first composable. */
function moduleMain(module: UfModule): string | undefined {
  return keyOwner(module.components, module.exports) ?? module.composables?.[0]?.name;
}

/** The names a module declares at its top level for its owners to read (ADR-0070). */
function moduleValueNames(module: UfModule): string[] {
  return [
    ...(module.constants ?? []).map(({ name }) => name),
    ...(module.moduleImports ?? []).flatMap(({ names }) => names.map(({ local }) => local)),
  ];
}

/**
 * The module values an owner reads itself (ADR-0070): those its bindings name, and those a
 * `typeof` queries in its own text (`keyof typeof SIZES`). `typeTexts` adds what the owner's IR
 * does not hold: a composable's parameter types.
 */
function ownValues(
  owner: UfComponent,
  module: UfModule,
  typeTexts: readonly TypeText[],
): Set<string> {
  const moduleValues = new Set(moduleValueNames(module));
  const values = new Set(
    owner.bindings
      .filter((binding) => binding.kind === "import" || binding.kind === "moduleConst")
      .map((binding) => binding.name),
  );
  const query = (text: string, kind: CodeKind | "type") => {
    for (const name of typeQueries(text, kind)) if (moduleValues.has(name)) values.add(name);
  };
  for (const { code } of codeOf(owner)) query(code.code, codeKind(code, owner));
  for (const text of [...ownTypes(owner), ...typeTexts]) query(text.code, "type");
  for (const declaration of componentTypes(owner, module)) query(declaration.code, "statements");
  return values;
}

/** What an output that declares the module's values declares (ADR-0070). */
interface ModuleReach {
  /** The constants and imported values it declares or imports, by local name. */
  values: Set<string>;
  /** The module's type declarations its constants name, transitively, beyond the owner's own. */
  types: Set<string>;
  /** The type names its constants and those declarations read. */
  named: Set<string>;
}

/**
 * The constants `values` reach and the module's types and values they name, transitively: what
 * an output that declares them declares, beside the types its owner declares as its own.
 */
function closure(values: ReadonlySet<string>, owner: UfComponent, module: UfModule): ModuleReach {
  const moduleValues = new Set(moduleValueNames(module));
  const reached = new Set(values);
  const query = (text: string, kind: CodeKind | "type") => {
    for (const name of typeQueries(text, kind)) if (moduleValues.has(name)) reached.add(name);
  };
  const own = new Set(owner.types);
  const named = new Set<string>();
  const types = new Set<string>();
  for (let size = -1; size !== reached.size + types.size;) {
    size = reached.size + types.size;
    for (const constant of module.constants ?? []) {
      if (!reached.has(constant.name)) continue;
      for (const reference of constant.value.refs) {
        if (reference.kind === "Binding") reached.add(nameOf(reference.binding));
      }
      if (constant.type) {
        for (const name of typeNames(constant.type)) named.add(name);
        query(constant.type.code, "type");
      }
      for (const name of codeNames(constant.value.code)) named.add(name);
      query(constant.value.code, "expression");
    }
    for (const declaration of module.types) {
      if (own.has(declaration.name) || !named.has(declaration.name)) continue;
      types.add(declaration.name);
      for (const name of codeNames(declaration.code, "statements")) named.add(name);
      query(declaration.code, "statements");
    }
  }
  return { values: reached, types, named };
}

/** The type text a composable's parameters and type parameters write, beside its IR's. */
function composableTypeTexts(composable: UfComposable): TypeText[] {
  return [
    ...composable.parameters.map(({ type }) => type),
    ...(composable.typeParameters ?? []).flatMap(({ constraint, default: fallback }) =>
      [constraint, fallback].filter((type): type is TypeText => type !== undefined),
    ),
  ];
}

/** The type text an owner's IR writes beside its code: its props', setup's and emits' types. */
function ownTypes(owner: UfComponent): TypeText[] {
  const found: TypeText[] = [];
  if (owner.propsParameter) found.push(owner.propsParameter.type);
  for (const prop of owner.props) found.push(prop.type);
  for (const item of owner.setup) if ("type" in item && item.type) found.push(item.type);
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
