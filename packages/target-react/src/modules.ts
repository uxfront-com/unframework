// What a component or a hook reads of its module on React (ADR-0070): the values it imports from
// relative `.ts` modules, which its output imports from its copy of the module as the source
// does, and the module's top-level constants, which its output declares at module scope as
// written, in source order. The output is a module whose function holds the setup, as the
// source's is, so every name keeps its meaning: the target claims its own names past them
// (`moduleNames`).
import { codeNames, typeNames } from "@unframework/codegen";
import type { ImportSet } from "@unframework/codegen";
import type { BindingId, TypeDeclaration, UfComponent, UfModule } from "@unframework/ir";

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
 * The module's values an owner reads, and those its constants read in turn: each value import is
 * added to `imports`, and each constant is declared.
 */
export function moduleReads(owner: UfComponent, module: UfModule, imports: ImportSet): ModuleReads {
  const constants = module.constants ?? [];
  const byBinding = new Map(constants.map((constant) => [constant.binding, constant]));
  const reached = new Set<BindingId>();
  const imported = new Set<string>();
  const reach = (id: BindingId, name: string) => {
    if (byBinding.has(id)) {
      if (reached.has(id)) return;
      reached.add(id);
      for (const reference of byBinding.get(id)!.value.refs) {
        if (reference.kind === "Binding") reach(reference.binding, nameOf(reference.binding));
      }
    } else {
      imported.add(name);
    }
  };
  for (const binding of owner.bindings) {
    if (binding.kind === "moduleConst" || binding.kind === "import")
      reach(binding.id, binding.name);
  }
  for (const entry of module.moduleImports ?? []) {
    for (const name of entry.names) {
      if (!imported.has(name.local)) continue;
      if (name.imported === "default")
        imports.addDefault(entry.specifier, name.local, { exact: true });
      else imports.add(entry.specifier, name.imported, { local: name.local, exact: true });
    }
  }
  const declared = constants.filter(({ binding }) => reached.has(binding));
  return {
    constants: declared.map(
      (constant) =>
        `const ${constant.name}${constant.type ? `: ${constant.type.code}` : ""} = ${constant.value.code};`,
    ),
    types: constantTypes(owner, module, declared),
  };
}

/**
 * The module's type declarations the constants name: those their annotations and values read,
 * and those these declarations read in turn, beyond the owner's own.
 */
function constantTypes(
  owner: UfComponent,
  module: UfModule,
  constants: NonNullable<UfModule["constants"]>,
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

/** The name a binding id holds, `name@offset`. */
function nameOf(id: BindingId): string {
  return id.slice(0, id.lastIndexOf("@"));
}
