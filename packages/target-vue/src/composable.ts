// A `.uf.ts` module's composable as its own Vue module, `useToggle.ts` (ADR-0069): the source's
// function with Vue's primitives, as a component's `<script setup>` writes its setup
// (`script.ts`), returning the members the source returns. And what a component or a composable
// reads of its module (ADR-0070): the values it imports from relative `.ts` modules, which every
// output imports from its copy of the module, and the module's top-level constants, which the
// output declares as the source does.
import {
  bindingOf,
  componentTypes,
  ImportSet,
  js,
  liveTypeNames,
  printProgram,
  typeDeclarationCode,
  typeNames,
  typeSpecifier,
} from "@unframework/codegen";
import type { EmitContext, OutputFile } from "@unframework/codegen";
import type { UfComponent, UfComposable, UfModule } from "@unframework/ir";

import { VueNames } from "./names.ts";
import { itemCode, itemLayout, laidOut, typeParametersText } from "./script.ts";
import type { Statement } from "./script.ts";

/**
 * A composable as the setup owner the codegen helpers read: its bindings, its setup and the
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
 * `useToggle.ts`: `export function useToggle(initial: boolean) { …; return { on, toggle }; }`,
 * its setup in source order as a component's script writes it (a state not known to be a
 * primitive is a `shallowRef`, `watchEffect` is `watchPostEffect`), its parameters as written,
 * since Vue reads a getter and calls a callback as the source does.
 */
export function emitComposable(composable: UfComposable, context: EmitContext): OutputFile[] {
  const { module } = context;
  const owner = setupOwner(composable);
  const names = new VueNames(owner, module);
  const imports = new ImportSet(names.scope);
  const rules = names.scriptRules(() => imports.add("vue", "nextTick"));
  const constants = moduleBindings(owner, module, imports);
  const statements: Statement[] = composable.setup.map((item) => {
    const code = itemCode(item, owner, module, names, imports, rules);
    return { code, layout: itemLayout(item, code) };
  });
  const returned = composable.returns.map((member) => {
    const local = names.local(bindingOf(owner, member.binding));
    return local === member.name ? local : `${member.name}: ${local}`;
  });
  statements.push({ code: `return { ${returned.join(", ")} };`, layout: "block" });
  const parameters = composable.parameters.map((parameter) => {
    const local = names.local(bindingOf(owner, parameter.binding));
    return `${local}${parameter.optional ? "?" : ""}: ${parameter.type.code}`;
  });
  // The types its parameters and type parameters name, beside what its setup prints (ADR-0067).
  const read = liveTypeNames(owner, module, { client: true });
  for (const parameter of composable.parameters)
    for (const name of typeNames(parameter.type)) read.add(name);
  for (const parameter of composable.typeParameters ?? []) {
    for (const type of [parameter.constraint, parameter.default]) {
      if (type) for (const name of typeNames(type)) read.add(name);
    }
  }
  for (const entry of module.typeImports ?? []) {
    for (const name of entry.names) {
      if (!read.has(name.local)) continue;
      const specifier = typeSpecifier(entry.specifier, module, (each) => `${each}.vue`);
      imports.add(specifier, name.imported, { type: true, local: name.local, exact: true });
    }
  }
  const head = imports.size > 0 ? printProgram(js.program(imports.toDeclarations())).trim() : "";
  const body = laidOut(statements).replaceAll("\n", "\n  ");
  const code = [
    ...(head ? [head] : []),
    ...componentTypes(owner, module).map(typeDeclarationCode),
    ...(constants.length ? [constants.join("\n")] : []),
    `export function ${composable.name}${typeParametersText(composable.typeParameters)}(${parameters.join(", ")}) {\n  ${body}\n}`,
  ].join("\n\n");
  return [{ path: `${composable.name}.ts`, contents: `${code}\n` }];
}

/**
 * What a component or a composable reads of its module (ADR-0070), added to its output's
 * imports, and the constants it declares, in source order: the imported values and the
 * constants it reads, and those its constants read in turn. A constant's value is copied as
 * written: it reads only globals, the module's constants and its imports, which the output
 * names as the source does.
 */
export function moduleBindings(owner: UfComponent, module: UfModule, imports: ImportSet): string[] {
  const reached = new Set(
    owner.bindings
      .filter((binding) => binding.kind === "import" || binding.kind === "moduleConst")
      .map((binding) => binding.name),
  );
  const constants = module.constants ?? [];
  // A constant's references name a binding by `name@offset`; a module's names are unique.
  for (let size = -1; size !== reached.size;) {
    size = reached.size;
    for (const constant of constants) {
      if (!reached.has(constant.name)) continue;
      for (const reference of constant.value.refs) {
        if (reference.kind === "Binding") {
          reached.add(reference.binding.slice(0, reference.binding.lastIndexOf("@")));
        }
      }
    }
  }
  for (const entry of module.moduleImports ?? []) {
    for (const name of entry.names) {
      if (reached.has(name.local)) {
        imports.add(entry.specifier, name.imported, { local: name.local, exact: true });
      }
    }
  }
  return constants
    .filter((constant) => reached.has(constant.name))
    .map(
      (constant) =>
        `const ${constant.name}${constant.type ? `: ${constant.type.code}` : ""} = ${constant.value.code};`,
    );
}
