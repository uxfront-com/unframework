// What a component or a composable reads of its module (ADR-0070): the values it imports from
// relative `.ts` modules, which its output imports from its copy of the module as the source
// does, and the module's top-level constants, which its output declares at module level as the
// source does. Class code reads both by their module names; the template reads them through
// members of those names (./members.ts).
import { codeNames, typeNames, typeSpecifier } from "@unframework/codegen";
import type { ImportSet } from "@unframework/codegen";
import type { Binding, TypeDeclaration, UfModule } from "@unframework/ir";

/** What an output reads of its module. */
export interface ModuleReads {
  /** The constants it declares, in source order, each as the source writes it. */
  constants: string[];
  /** The module's type declarations its constants name, transitively. */
  types: TypeDeclaration[];
}

/**
 * The module's values an output reaches (ADR-0070): those its bindings read, and those its
 * constants read in turn. Each value import is added to `imports` under the source's own name,
 * and each type import its constants name; the constants are copied as written, since a module
 * name keeps its name in every Angular output.
 */
export function moduleReads(
  bindings: readonly Binding[],
  module: UfModule,
  imports: ImportSet,
  file: (name: string) => string,
): ModuleReads {
  const values = new Set(
    bindings
      .filter((binding) => binding.kind === "import" || binding.kind === "moduleConst")
      .map((binding) => binding.name),
  );
  const constants = module.constants ?? [];
  // A constant's references name a binding by `name@offset`; a module's names are unique.
  for (let size = -1; size !== values.size;) {
    size = values.size;
    for (const constant of constants) {
      if (!values.has(constant.name)) continue;
      for (const reference of constant.value.refs) {
        if (reference.kind === "Binding") values.add(reference.binding.split("@")[0]!);
      }
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
  const declared = constants.filter((constant) => values.has(constant.name));
  // The types they name: the module's declarations, transitively, and the type imports.
  const named = new Set<string>();
  for (const constant of declared) {
    if (constant.type) for (const name of typeNames(constant.type)) named.add(name);
    for (const name of codeNames(constant.value.code)) named.add(name);
  }
  const types = new Map<string, TypeDeclaration>();
  for (let size = -1; size !== types.size;) {
    size = types.size;
    for (const declaration of module.types) {
      if (types.has(declaration.name) || !named.has(declaration.name)) continue;
      types.set(declaration.name, declaration);
      for (const name of codeNames(declaration.code, "statements")) named.add(name);
    }
  }
  for (const entry of module.typeImports ?? []) {
    for (const name of entry.names) {
      if (!named.has(name.local)) continue;
      imports.add(typeSpecifier(entry.specifier, module, file), name.imported, {
        type: true,
        local: name.local,
        exact: true,
      });
    }
  }
  return {
    constants: declared.map(
      (constant) =>
        `const ${constant.name}${constant.type ? `: ${constant.type.code}` : ""} = ${constant.value.code};`,
    ),
    types: module.types.filter((declaration) => types.has(declaration.name)),
  };
}
