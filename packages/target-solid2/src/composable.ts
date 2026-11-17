// Composables and shared modules as Solid writes them (ADR-0069, ADR-0070).
//
// - A `.uf.ts` module's composable is its own module, `useToggle.ts`: the source's exported
//   function, its parameters and type parameters as written, its setup as a component's
//   (src/setup.ts), and a returned object of accessors for its state and derived values, with its
//   functions and constants as they are: `return { on, toggle };`, where `on` is the signal's
//   getter. A caller imports it from that module, destructures it as the source does and calls
//   each accessor, `on()`.
// - A value a component or a composable imports from a relative `.ts` module is imported as the
//   source imports it, from the copy beside the outputs, and the module's constants it reads, and
//   those they read, are declared at module scope as written, as the source declares them, with
//   the module's types they name. Every module name is reserved before the output claims its
//   own, so each keeps its name.
import {
  addTypeImports,
  codeKind,
  codeNames,
  componentTypes,
  exportDeclaration,
  exportsOf,
  ImportSet,
  js,
  NameScope,
  parseCodeSource,
  parseExpressionSource,
  Placeholders,
  printComponentModule,
  sourceNames,
  typeNames,
  typeSpecifier,
} from "@unframework.dev/codegen";
import type { CodeKind, EmitContext, OutputFile } from "@unframework.dev/codegen";
import { codeOf } from "@unframework.dev/ir";
import type {
  TypeDeclaration,
  TypeText,
  UfComponent,
  UfComposable,
  UfModule,
} from "@unframework.dev/ir";

import { SolidComposition } from "./composition.ts";
import { typeParameterDeclaration } from "./generics.ts";
import type { SolidProps } from "./props.ts";
import { moduleMain, nameOf, solidSetup, SolidCode } from "./setup.ts";

// The ESTree node types, named through codegen's builders: a target imports only ir and codegen.
type Statement = ReturnType<Placeholders["statements"]>;

/**
 * `useToggle.ts`: `export function useToggle(initial: boolean) { …; return { on, toggle }; }`,
 * its setup in source order as a component's is written, hoisting what captures nothing of it.
 * A getter parameter is called and a callback called as the source does, so both are as written.
 */
export function emitComposable(composable: UfComposable, context: EmitContext): OutputFile[] {
  const { module } = context;
  const owner = setupOwner(composable);
  const parameterTypes = composableTypeTexts(composable);
  const names = sourceNames(owner, module);
  for (const type of parameterTypes) for (const name of typeNames(type)) names.add(name);
  for (const name of moduleValueNames(module)) names.add(name);
  const imports = new ImportSet(new NameScope(names));
  const placeholders = new Placeholders();
  const composition = new SolidComposition(owner, module, imports);
  // A composable takes parameters, never props.
  const props: SolidProps = { parameters: [], statements: [], read: (_binding, text) => text };
  const code = new SolidCode(owner, imports, props, composition);
  const setup = solidSetup(code, placeholders);
  const bindings = new Map(owner.bindings.map((binding) => [binding.id, binding.name]));
  const returned = composable.returns.map(({ name, binding }) => {
    const local = bindings.get(binding)!;
    return local === name ? local : `${name}: ${local}`;
  });
  const parameters = composable.parameters.map((parameter) => {
    const identifier = js.bindingIdentifier(
      bindings.get(parameter.binding)!,
      placeholders.type(parameter.type.code),
    );
    if (parameter.optional) Object.assign(identifier, { optional: true });
    return identifier;
  });
  const fn = js.functionDeclaration(composable.name, parameters, [
    ...setup.statements,
    placeholders.statements(
      `${setup.statements.length ? "\n" : ""}return { ${returned.join(", ")} };`,
    ),
  ]);
  fn.typeParameters = typeParameterDeclaration(owner, placeholders);
  const reads = moduleReads(composable.name, module, imports, placeholders);
  addTypeImports(owner, module, imports, (name) => name);
  // The types its parameters name, which its IR as a setup owner holds no trace of (ADR-0067).
  addNamedTypeImports(
    module,
    imports,
    new Set(parameterTypes.flatMap((type) => [...typeNames(type)])),
  );
  return [
    {
      path: `${composable.name}.ts`,
      contents: printComponentModule({
        types: [...componentTypes(owner, module), ...reads.types].toSorted(
          (a, b) => a.span.start - b.span.start,
        ),
        body: [
          ...reads.constants,
          ...setup.hoisted,
          ...exportDeclaration(composable.name, fn, exportsOf(composable.name, [])),
        ],
        helpers: code.helpers(),
        // Collected last: the helpers import what they call.
        imports: imports.toDeclarations(),
        placeholders,
      }),
    },
  ];
}

/**
 * A composable as the setup owner the setup's lowering reads: its bindings, its setup and the
 * types it declares, with no props and nothing to render.
 */
function setupOwner(composable: UfComposable): UfComponent {
  return {
    name: composable.name,
    span: composable.span,
    ...(composable.typeParameters ? { typeParameters: composable.typeParameters } : {}),
    props: [],
    types: composable.types,
    bindings: composable.bindings,
    setup: composable.setup,
    render: { kind: "Fragment", children: [], span: composable.span },
  };
}

/**
 * The imports of the composables a component calls (ADR-0069): each from its own output, named
 * by the composable beside its `.uf.ts` module, under the source's local name.
 */
export function addComposableImports(
  component: UfComponent,
  module: UfModule,
  imports: ImportSet,
): void {
  const called = new Set(
    component.setup.flatMap((item) => (item.kind === "Use" ? [item.composable] : [])),
  );
  for (const entry of module.imports ?? []) {
    const directory = entry.specifier.slice(0, entry.specifier.lastIndexOf("/") + 1);
    for (const name of entry.names) {
      if (name.kind !== "Composable" || !called.has(name.local)) continue;
      imports.add(`${directory}${name.imported}`, name.imported, {
        local: name.local,
        exact: true,
      });
    }
  }
}

/** The names a module declares at its top level for its components to read (ADR-0070). */
export function moduleValueNames(module: UfModule): string[] {
  return [
    ...(module.constants ?? []).map(({ name }) => name),
    ...(module.moduleImports ?? []).flatMap(({ names }) => names.map(({ local }) => local)),
  ];
}

/** What an owner's output declares of its module (ADR-0070). */
export interface ModuleReads {
  /**
   * The constants it declares, in source order, as written, and the `export { … }` of what its
   * siblings import from it.
   */
  constants: Statement[];
  /** The module's type declarations its constants name, transitively, beyond its own types. */
  types: TypeDeclaration[];
}

/**
 * What a component or a composable reads of its module (ADR-0070), added to its output: each
 * imported value it reaches, imported as the source imports it, and each constant it reaches,
 * declared as written, with the module's types and the type imports their annotations name.
 *
 * A source's script outputs load as one module, the files joined in source order (ADR-0053), where
 * a name may be declared once and a constant's value runs as the module loads. So where a module
 * has several owners (its components, or a `.uf.ts` module's composables), its main owner
 * (`moduleMain`) declares every module value any of them reaches and exports those the others
 * read, `export { STEP };`, and every other owner imports what it reads from the main one's
 * output, `import { STEP } from "./Pair"`, as a sibling's key is (ADR-0054). The others then run
 * nothing of the module as they load (src/setup.ts keeps their constants that read it in the
 * component), so neither the join's order nor the import cycle between the files matters.
 */
export function moduleReads(
  name: string,
  module: UfModule,
  imports: ImportSet,
  placeholders: Placeholders,
): ModuleReads {
  if (!moduleValueNames(module).length) return { constants: [], types: [] };
  const owners = [
    ...module.components.map((component) => ({ owner: component, typeTexts: [] as TypeText[] })),
    ...(module.composables ?? []).map((composable) => ({
      owner: setupOwner(composable),
      typeTexts: composableTypeTexts(composable),
    })),
  ];
  const main = moduleMain(module)!;
  const own = owners.find(({ owner }) => owner.name === name)!;
  const direct = ownValues(own.owner, module, own.typeTexts);
  if (owners.length > 1 && name !== main) {
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
  addNamedTypeImports(module, imports, closed.named);
  const constants = (module.constants ?? []).filter((constant) => closed.values.has(constant.name));
  const lines = [
    ...constants.map(
      (constant) =>
        `const ${constant.name}${constant.type ? `: ${constant.type.code}` : ""} = ${constant.value.code};`,
    ),
    ...(exported.size ? [`export { ${[...exported].toSorted().join(", ")} };`] : []),
  ];
  return {
    constants: lines.map((line, index) =>
      placeholders.statements(`${line}${index === lines.length - 1 ? "\n" : ""}`),
    ),
    types: module.types.filter((declaration) => closed.types.has(declaration.name)),
  };
}

/** What an output declares of its module (ADR-0070). */
interface ModuleReach {
  /** The constants and imported values it declares or imports, by local name. */
  values: Set<string>;
  /** The module's type declarations its constants name, transitively, beyond the owner's own. */
  types: Set<string>;
  /** The type names its constants and those declarations read. */
  named: Set<string>;
}

/**
 * The module values an owner reads itself (ADR-0070): those its bindings name, and those a
 * `typeof` queries in its own text (`keyof typeof SIZES`). `typeTexts` adds what the owner's IR
 * does not hold: a composable's parameter types.
 */
function ownValues(
  owner: UfComponent,
  module: UfModule,
  typeTexts: readonly TypeText[] = [],
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

/**
 * Imports each of the module's `import type` names in `names`, under the source's local name,
 * from `typeSpecifier` (ADR-0067).
 */
function addNamedTypeImports(
  module: UfModule,
  imports: ImportSet,
  names: ReadonlySet<string>,
): void {
  for (const entry of module.typeImports ?? []) {
    for (const name of entry.names) {
      if (!names.has(name.local)) continue;
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
      for (const item of node) visit(item);
      return;
    }
    if (!node || typeof node !== "object") return;
    const each = node as { type?: unknown; exprName?: unknown };
    if (each.type === "TSTypeQuery") {
      let name = each.exprName as { type?: unknown; left?: unknown; name?: unknown } | undefined;
      while (name?.type === "TSQualifiedName") name = name.left as typeof name;
      if (name?.type === "Identifier" && typeof name.name === "string") found.push(name.name);
    }
    for (const [key, value] of Object.entries(node)) if (key !== "parent") visit(value);
  };
  visit(root);
  return found;
}
