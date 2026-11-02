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
} from "@unframework/codegen";
import type { CodeKind, EmitContext, OutputFile } from "@unframework/codegen";
import { codeOf } from "@unframework/ir";
import type {
  TypeDeclaration,
  TypeText,
  UfComponent,
  UfComposable,
  UfModule,
} from "@unframework/ir";

import { SolidComposition } from "./composition.ts";
import { typeParameterDeclaration } from "./generics.ts";
import type { SolidProps } from "./props.ts";
import { solidSetup, SolidCode } from "./setup.ts";

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
  const parameterTypes = composable.parameters.map(({ type }) => type);
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
  const reads = moduleReads(owner, module, imports, placeholders, parameterTypes);
  addTypeImports(owner, module, imports, (name) => name);
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
  /** The constants it reaches, in source order, as written. */
  constants: Statement[];
  /** The module's type declarations its constants name, transitively, beyond its own types. */
  types: TypeDeclaration[];
}

/**
 * What a component or a composable reads of its module (ADR-0070), added to its output: each
 * imported value it reaches, imported as the source imports it, and each constant it reaches,
 * declared as written. It reaches the values its bindings name, those a `typeof` queries in its
 * own text (`keyof typeof SIZES`), and those its constants and the module's types it copies read
 * in turn. The type imports their annotations and the copied declarations name are imported too.
 * `typeTexts` adds what the owner's IR does not hold: a composable's parameter types.
 */
export function moduleReads(
  owner: UfComponent,
  module: UfModule,
  imports: ImportSet,
  placeholders: Placeholders,
  typeTexts: readonly TypeText[] = [],
): ModuleReads {
  const moduleValues = new Set(moduleValueNames(module));
  if (!moduleValues.size) return { constants: [], types: [] };
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
  const own = new Set(owner.types);
  for (const declaration of componentTypes(owner, module)) query(declaration.code, "statements");
  // The constants those reach, and the module's types and values they name, transitively.
  const named = new Set<string>();
  const declared = new Set<string>();
  for (let size = -1; size !== values.size + declared.size;) {
    size = values.size + declared.size;
    for (const constant of module.constants ?? []) {
      if (!values.has(constant.name)) continue;
      for (const reference of constant.value.refs) {
        if (reference.kind === "Binding") values.add(nameOf(reference.binding));
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
      declared.add(declaration.name);
      for (const name of codeNames(declaration.code, "statements")) named.add(name);
      query(declaration.code, "statements");
    }
  }
  for (const entry of module.moduleImports ?? []) {
    for (const name of entry.names) {
      if (!values.has(name.local)) continue;
      if (name.imported === "default")
        imports.addDefault(entry.specifier, name.local, { exact: true });
      else imports.add(entry.specifier, name.imported, { local: name.local, exact: true });
    }
  }
  // The type imports the constants and the copied declarations name, beside the owner's own.
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
  const constants = (module.constants ?? []).filter((constant) => values.has(constant.name));
  return {
    constants: constants.map((constant, index) =>
      placeholders.statements(
        `const ${constant.name}${constant.type ? `: ${constant.type.code}` : ""} = ${constant.value.code};${index === constants.length - 1 ? "\n" : ""}`,
      ),
    ),
    types: module.types.filter((declaration) => declared.has(declaration.name)),
  };
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

/** The name of a binding id, `name@offset`. */
function nameOf(id: string): string {
  return id.slice(0, id.lastIndexOf("@"));
}
