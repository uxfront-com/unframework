// A `.uf.ts` module's composable as its own Vue module, `useToggle.ts` (ADR-0069): the source's
// function with Vue's primitives, as a component's `<script setup>` writes its setup
// (`script.ts`), returning the members the source returns. And what a component or a composable
// reads of its module (ADR-0070): the values it imports from relative `.ts` modules, which every
// output imports from its copy of the module, and the module's top-level constants, which the
// output declares as the source does.
import {
  bindingOf,
  codeNames,
  componentTypes,
  ImportSet,
  js,
  liveTypeNames,
  parseExpressionSource,
  printProgram,
  typeNames,
  typeSpecifier,
} from "@unframework/codegen";
import type { EmitContext, OutputFile } from "@unframework/codegen";
import type {
  Code,
  TypeDeclaration,
  TypeText,
  UfComponent,
  UfComposable,
  UfModule,
} from "@unframework/ir";

import { nameOf, renamedQueries, typeQueries, VueNames } from "./names.ts";
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
  // The types its parameters and type parameters name, which its IR as a setup owner holds no
  // trace of (ADR-0067).
  const parameterTexts: TypeText[] = [
    ...composable.parameters.map(({ type }) => type),
    ...(composable.typeParameters ?? []).flatMap(({ constraint, default: fallback }) =>
      [constraint, fallback].filter((type): type is TypeText => type !== undefined),
    ),
  ];
  const parameterTypes = new Set(parameterTexts.flatMap((type) => [...typeNames(type)]));
  const names = new VueNames(owner, module, parameterTexts);
  const imports = new ImportSet(names.scope);
  const rules = names.scriptRules(() => imports.add("vue", "nextTick"));
  const reads = moduleBindings(owner, module, imports, names);
  const statements: Statement[] = composable.setup.map((item) => {
    const code = names.ownQueries(itemCode(item, owner, module, names, imports, rules));
    return { code, layout: itemLayout(item, code) };
  });
  const returned = composable.returns.map((member) => {
    const local = names.local(bindingOf(owner, member.binding));
    return local === member.name ? local : `${member.name}: ${local}`;
  });
  statements.push({ code: `return { ${returned.join(", ")} };`, layout: "block" });
  // A parameter list sees its parameters, never its body's locals (ADR-0070).
  const bound = composable.parameters.map(({ name }) => name);
  const parameters = composable.parameters.map((parameter) => {
    const local = names.local(bindingOf(owner, parameter.binding));
    const type = renamedQueries(parameter.type.code, "type", names, { bound });
    return `${local}${parameter.optional ? "?" : ""}: ${type}`;
  });
  // What its setup prints names, beside its parameters' and its constants' types.
  const read = liveTypeNames(owner, module, { client: true });
  for (const name of [...parameterTypes, ...reads.typeNames]) read.add(name);
  addReadTypeImports(module, imports, read);
  const head = imports.size > 0 ? printProgram(js.program(imports.toDeclarations())).trim() : "";
  const body = laidOut(statements).replaceAll("\n", "\n  ");
  const code = [
    ...(head ? [head] : []),
    ...[...componentTypes(owner, module), ...reads.types]
      .toSorted((a, b) => a.span.start - b.span.start)
      .map((declaration) => declarationCode(declaration, names)),
    ...(reads.constants.length ? [reads.constants.join("\n")] : []),
    `export function ${composable.name}${typeParametersText(composable.typeParameters)}(${parameters.join(", ")}) {\n  ${body}\n}`,
  ].join("\n\n");
  return [{ path: `${composable.name}.ts`, contents: `${code}\n` }];
}

/**
 * A type declaration as the output writes it: the source's, with each module name a `typeof`
 * queries spelled as the output names it, and exported where `exported` says.
 */
export function declarationCode(
  declaration: TypeDeclaration,
  names: VueNames,
  exported: boolean = declaration.exported,
): string {
  const code = renamedQueries(declaration.code, "statements", names);
  return exported ? `export ${code}` : code;
}

/** What a component or a composable reads of its module (ADR-0070). */
export interface ModuleReads {
  /** The constants it declares, in source order, each as written but for a renamed name. */
  constants: string[];
  /**
   * The module's type declarations its constants name, transitively, that its own types leave
   * out, to declare beside them.
   */
  types: TypeDeclaration[];
  /** The type names its constants and those declarations name, which its output imports. */
  typeNames: Set<string>;
}

/**
 * What a component or a composable reads of its module (ADR-0070): the imported values and the
 * constants it reads, and those its constants read in turn. Each value import is added to the
 * output's imports, as the source writes it. A constant's value reads only globals, the
 * module's constants and its imports, so it is copied as written, but for a module name Vue
 * declares under another (`VueNames`). The types a constant names come with it: its
 * annotation's, and those its value names (`satisfies Tone[]`).
 */
export function moduleBindings(
  owner: UfComponent,
  module: UfModule,
  imports: ImportSet,
  names: VueNames,
): ModuleReads {
  const reached = names.reach.values;
  const constants = module.constants ?? [];
  for (const entry of module.moduleImports ?? []) {
    for (const name of entry.names) {
      if (!reached.has(name.local)) continue;
      const local = names.moduleLocal(name.local);
      if (name.imported === "default") imports.addDefault(entry.specifier, local, { exact: true });
      else imports.add(entry.specifier, name.imported, { local, exact: true });
    }
  }
  const declared = constants.filter((constant) => reached.has(constant.name));
  return {
    constants: declared.map(
      (constant) =>
        `const ${names.moduleLocal(constant.name)}${constant.type ? `: ${renamedQueries(constant.type.code, "type", names)}` : ""} = ${renamed(constant.value, names)};`,
    ),
    ...constantTypes(owner, module, reached),
  };
}

/**
 * The types the constants an owner declares name (ADR-0070): the names their annotations and
 * values read, and the module's declarations those reach, transitively, beyond the owner's own.
 */
export function constantTypes(
  owner: UfComponent,
  module: UfModule,
  reached: ReadonlySet<string>,
): Pick<ModuleReads, "types" | "typeNames"> {
  const read = new Set<string>();
  for (const constant of module.constants ?? []) {
    if (!reached.has(constant.name)) continue;
    if (constant.type) for (const name of typeNames(constant.type)) read.add(name);
    for (const name of codeNames(constant.value.code)) read.add(name);
  }
  // The module's declarations those names reach, and the names they read in turn.
  const own = new Set(owner.types);
  const types = new Map<string, TypeDeclaration>();
  for (let size = -1; size !== types.size;) {
    size = types.size;
    for (const declaration of module.types) {
      if (own.has(declaration.name) || types.has(declaration.name)) continue;
      if (!read.has(declaration.name)) continue;
      types.set(declaration.name, declaration);
      for (const name of codeNames(declaration.code, "statements")) read.add(name);
    }
  }
  return {
    types: module.types.filter((declaration) => types.has(declaration.name)),
    typeNames: read,
  };
}

/** Adds the `import type` names in `read` to an output's imports, as the source names them. */
export function addReadTypeImports(
  module: UfModule,
  imports: ImportSet,
  read: ReadonlySet<string>,
): void {
  for (const entry of module.typeImports ?? []) {
    for (const name of entry.names) {
      if (!read.has(name.local)) continue;
      const specifier = typeSpecifier(entry.specifier, module, (each) => `${each}.vue`);
      imports.add(specifier, name.imported, { type: true, local: name.local, exact: true });
    }
  }
}

/**
 * A constant's value, with each module name Vue declares under another written by that name, a
 * shorthand property expanded (`{ defineProps: defineProps_1 }`).
 */
function renamed(value: Code, names: VueNames): string {
  // Its references, and the roots of the `typeof`s in it (`as typeof step`), which are none.
  const edits: { start: number; end: number; text: string }[] = [];
  let shorthand: ReadonlySet<number> | undefined;
  for (const reference of value.refs) {
    if (reference.kind !== "Binding") continue;
    const name = nameOf(reference.binding);
    const local = names.moduleLocal(name);
    if (local === name) continue;
    const start = reference.span.start - value.span.start;
    shorthand ??= shorthandValues(value.code);
    const key = reference.shorthand || shorthand.has(start) ? `${name}: ` : "";
    edits.push({ start, end: reference.span.end - value.span.start, text: `${key}${local}` });
  }
  for (const { name, start, end } of typeQueries(value.code, "expression")) {
    const local = names.moduleLocal(name);
    if (local !== name) edits.push({ start, end, text: local });
  }
  let written = "";
  let last = 0;
  for (const { start, end, text } of edits.toSorted((a, b) => a.start - b.start)) {
    written += `${value.code.slice(last, start)}${text}`;
    last = end;
  }
  return `${written}${value.code.slice(last)}`;
}

/**
 * Where an expression's shorthand properties' values start (`{ LIMITS }`): a constant's
 * references carry no `shorthand` mark, so the code says.
 */
function shorthandValues(code: string): Set<number> {
  const found = new Set<number>();
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (!node || typeof node !== "object") return;
    const each = node as { type?: unknown; shorthand?: unknown; value?: { start?: unknown } };
    if (
      each.type === "Property" &&
      each.shorthand === true &&
      typeof each.value?.start === "number"
    ) {
      found.add(each.value.start);
    }
    for (const [key, value] of Object.entries(node)) if (key !== "parent") visit(value);
  };
  visit(parseExpressionSource(code).expression);
  return found;
}
