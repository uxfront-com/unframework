// Directives (ADR-0099): what every target prints of a directive alike. Its hooks are the
// author's code, copied as written: they read their own parameters, the browser's globals and
// the module's constants and value imports, which keep their names in every output. Each target
// wraps them in its own idiom (Vue's `ObjectDirective`, Svelte's attachment, Solid's ref
// factory, Angular's attribute directive, React's and Qwik's helper).
import { walk } from "@unframework.dev/ir";
import type {
  DirectiveAttribute,
  DirectiveHook,
  Expression,
  UfComponent,
  UfDirective,
  UfModule,
} from "@unframework.dev/ir";

import { typeNames } from "./names.ts";
import { codeNames } from "./rewrite.ts";

/** The element's type a directive's hooks take: `E`, or `HTMLElement`. */
export function directiveElement(directive: UfDirective): string {
  return directive.element?.code ?? "HTMLElement";
}

/** A directive's hook of a name, or `undefined` where it declares none. */
export function directiveHook(
  directive: UfDirective,
  name: DirectiveHook["name"],
): DirectiveHook | undefined {
  return directive.hooks.find((hook) => hook.name === name);
}

/**
 * The parameters a hook's output declares: the author's, but the trailing ones its body never
 * reads, which a source's type check allows and every output's lint (L5) reports.
 */
export function hookParameters(hook: DirectiveHook): string[] {
  const read = codeNames(hook.body.code, "statements");
  let count = hook.parameters.length;
  while (count > 0 && !read.has(hook.parameters[count - 1]!)) {
    count--;
  }
  return hook.parameters.slice(0, count);
}

/**
 * A hook's parameters, typed as `defineDirective`'s type arguments give them: the element, then
 * the value and the previous value, as many as {@link hookParameters} keeps.
 */
export function directiveParameters(directive: UfDirective, hook: DirectiveHook): string[] {
  const types = [directiveElement(directive), directive.value.code, directive.value.code];
  return hookParameters(hook).map((name, index) => `${name}: ${types[index]}`);
}

/**
 * A directive's hooks as a plain object of typed methods, in source order:
 * `{ mounted(el: HTMLElement, value: boolean) { … }, … }`, the author's code as written. A hook
 * keeps the return type the source infers: `defineDirective`'s hooks return `void`, which takes
 * any value.
 */
export function directiveHooksObject(directive: UfDirective): string {
  const methods = directive.hooks.map(
    (hook) =>
      `${hook.async ? "async " : ""}${hook.name}(${directiveParameters(directive, hook).join(", ")}) ${hook.body.code}`,
  );
  return `{\n${methods.map((method) => `  ${method},`).join("\n")}\n}`;
}

/**
 * Names for what a target's wrapper declares around a directive's hooks (`hooks`, `element`,
 * `current`), each its base or the base with `_1`, `_2`… where a hook reads that name, so no
 * wrapper's local hides a module's constant or a global the hooks read.
 */
export function wrapperNames<const K extends string>(
  directive: UfDirective,
  bases: readonly K[],
): Record<K, string> {
  const taken = new Set<string>();
  for (const hook of directive.hooks) {
    for (const name of codeNames(hook.body.code, "statements")) {
      taken.add(name);
    }
  }
  const names = {} as Record<K, string>;
  for (const base of bases) {
    let name: string = base;
    for (let index = 1; taken.has(name); index++) {
      name = `${base}_${index}`;
    }
    taken.add(name);
    names[base] = name;
  }
  return names;
}

/** What a directive's own module declares and imports of its source module (ADR-0070). */
export interface DirectiveDependencies {
  /** Each value import its hooks or constants reach, as written. */
  imports: { specifier: string; imported: string; local: string }[];
  /** Each type import its hooks, constants or types name, as written. */
  typeImports: { specifier: string; imported: string; local: string }[];
  /** The module's type declarations it reaches, in source order, each as written. */
  types: string[];
  /** The module's constants it reaches, in source order, each as written. */
  constants: string[];
}

/**
 * What a `.uf.ts` directive's module copies of its source (ADR-0070, ADR-0099): the constants its
 * hooks read and those they read in turn, the value imports any of them reads, and the types its
 * hooks, its type arguments and those constants name, with the declarations they reach.
 */
export function directiveDependencies(
  directive: UfDirective,
  module: UfModule,
): DirectiveDependencies {
  const values = new Set(directive.bindings.map(({ name }) => name));
  const constants = module.constants ?? [];
  for (let size = -1; size !== values.size;) {
    size = values.size;
    for (const constant of constants) {
      if (!values.has(constant.name)) {
        continue;
      }
      for (const reference of constant.value.refs) {
        if (reference.kind === "Binding") {
          values.add(reference.binding.slice(0, reference.binding.lastIndexOf("@")));
        }
      }
    }
  }
  const named = new Set<string>([
    ...typeNames(directive.value),
    ...(directive.element ? typeNames(directive.element) : []),
    ...directive.types,
  ]);
  for (const hook of directive.hooks) {
    for (const name of codeNames(hook.body.code, "statements")) {
      named.add(name);
    }
  }
  for (const constant of constants) {
    if (!values.has(constant.name)) {
      continue;
    }
    if (constant.type) {
      for (const name of typeNames(constant.type)) {
        named.add(name);
      }
    }
    for (const name of codeNames(constant.value.code)) {
      named.add(name);
    }
  }
  const declared = new Set<string>();
  for (let size = -1; size !== declared.size;) {
    size = declared.size;
    for (const declaration of module.types) {
      if (declared.has(declaration.name) || !named.has(declaration.name)) {
        continue;
      }
      declared.add(declaration.name);
      for (const name of codeNames(declaration.code, "statements")) {
        named.add(name);
      }
    }
  }
  return {
    imports: (module.moduleImports ?? []).flatMap((entry) =>
      entry.names
        .filter(({ local }) => values.has(local))
        .map(({ imported, local }) => ({ specifier: entry.specifier, imported, local })),
    ),
    typeImports: (module.typeImports ?? []).flatMap((entry) =>
      entry.names
        .filter(({ local }) => named.has(local))
        .map(({ imported, local }) => ({ specifier: entry.specifier, imported, local })),
    ),
    types: module.types
      .filter(({ name }) => declared.has(name))
      .map((declaration) =>
        declaration.exported ? `export ${declaration.code}` : declaration.code,
      ),
    constants: constants
      .filter(({ name }) => values.has(name))
      .map(
        (constant) =>
          `const ${constant.name}${constant.type ? `: ${constant.type.code}` : ""} = ${constant.value.code};`,
      ),
  };
}

/**
 * The names a directive's own module leaves to what it copies (ADR-0099): every name the hooks,
 * the copied constants and types and their imports declare or read, and the directive's own. The
 * module's imports of its framework and its helpers take other names.
 */
export function directiveModuleNames(
  directive: UfDirective,
  dependencies: DirectiveDependencies,
): Set<string> {
  const taken = new Set<string>([directive.name]);
  for (const code of [
    ...directive.hooks.map((hook) => hook.body.code),
    ...dependencies.types,
    ...dependencies.constants,
  ]) {
    for (const name of codeNames(code, "statements")) {
      taken.add(name);
    }
  }
  for (const { local } of [...dependencies.imports, ...dependencies.typeImports]) {
    taken.add(local);
  }
  return taken;
}

/** The import declarations of a directive module's dependencies, as written. */
export function dependencyImports(dependencies: DirectiveDependencies): string[] {
  const lines: string[] = [];
  const group = (entries: DirectiveDependencies["imports"], type: boolean): void => {
    const bySpecifier = new Map<string, string[]>();
    for (const { specifier, imported, local } of entries) {
      const names = bySpecifier.get(specifier) ?? [];
      names.push(imported === local ? local : `${imported} as ${local}`);
      bySpecifier.set(specifier, names);
    }
    for (const [specifier, names] of bySpecifier) {
      const defaults = names.filter((name) => name.startsWith("default as "));
      const named = names.filter((name) => !name.startsWith("default as "));
      const parts = [
        ...defaults.map((name) => name.slice("default as ".length)),
        ...(named.length ? [`{ ${named.join(", ")} }`] : []),
      ];
      lines.push(
        `import ${type ? "type " : ""}${parts.join(", ")} from ${JSON.stringify(specifier)};`,
      );
    }
  };
  group(dependencies.typeImports, true);
  group(dependencies.imports, false);
  return lines;
}

/**
 * The directives a module's components apply, by name: its own, and those it imports, each with
 * the specifier of its `.uf.ts` module, or none for the module's own.
 */
export function moduleDirectives(
  module: UfModule,
): Map<string, { directive?: UfDirective; specifier?: string; imported?: string }> {
  const found = new Map<
    string,
    { directive?: UfDirective; specifier?: string; imported?: string }
  >();
  for (const directive of module.directives ?? []) {
    if (!directive.exported) {
      found.set(directive.name, { directive });
    }
  }
  for (const entry of module.imports ?? []) {
    for (const name of entry.names) {
      if (name.kind === "Directive") {
        found.set(name.local, { specifier: entry.specifier, imported: name.imported });
      }
    }
  }
  return found;
}

/**
 * The specifier a component's output imports an imported directive's module by: beside its
 * `.uf.ts` module, named as the target names the directive's file (`./vFocusTrap`).
 */
export function directiveSpecifier(specifier: string, file: string): string {
  return `${specifier.slice(0, specifier.lastIndexOf("/") + 1)}${file}`;
}

/**
 * A call of a hook of a directive's hooks object, `hooks.mounted(el, value)`, with as many of the
 * arguments as the hook takes: the element, the value and the previous value.
 */
export function hookCall(hooks: string, hook: DirectiveHook, args: readonly string[]): string {
  return `${hooks}.${hook.name}(${args.slice(0, hookParameters(hook).length).join(", ")})`;
}

/** The names of the directives a component's elements apply (ADR-0099). */
export function appliedDirectives(component: UfComponent): Set<string> {
  const names = new Set<string>();
  walk(component.render, {
    enter(node) {
      if (node.kind !== "Element") {
        return;
      }
      for (const attribute of node.attributes) {
        if (attribute.kind === "Directive") {
          names.add(attribute.name);
        }
      }
    },
  });
  return names;
}

/**
 * Whether a directive's value reads a name that a list's callback or a scoped fill declares
 * (ADR-0108): the value then differs at each element one use renders, so a target that gives a
 * use one value at the component's top level (React's hook, Qwik's task) takes each element's
 * own, which the element passes where it renders.
 */
export function readsElementScope(attribute: DirectiveAttribute, component: UfComponent): boolean {
  const scoped = new Set(
    component.bindings
      .filter(({ kind }) => kind === "loopVar" || kind === "slotScope")
      .map(({ id }) => id),
  );
  return attribute.value.refs.some(
    (reference) => reference.kind === "Binding" && scoped.has(reference.binding),
  );
}

/** The directives of its own module a component applies, in the module's order (ADR-0099). */
export function ownDirectives(component: UfComponent, module: UfModule): UfDirective[] {
  const applied = appliedDirectives(component);
  return (module.directives ?? []).filter(
    (directive) => !directive.exported && applied.has(directive.name),
  );
}

/**
 * The directives a component applies from `.uf.ts` modules, each with the specifier of its
 * module and the name it exports, and the local name the component applies it by.
 */
export function importedDirectives(
  component: UfComponent,
  module: UfModule,
): { specifier: string; imported: string; local: string }[] {
  const applied = appliedDirectives(component);
  return (module.imports ?? []).flatMap((entry) =>
    entry.names
      .filter((name) => name.kind === "Directive" && applied.has(name.local))
      .map((name) => ({ specifier: entry.specifier, imported: name.imported, local: name.local })),
  );
}

/**
 * A directive's value as code that reads it outside the branches around its element (React's
 * getter at the top of the component, Qwik's task): each path a conditional around the element
 * narrows, which the value relies on (`NarrowedPath`, `template`), asserted present with `!`, as
 * TypeScript narrows it no more there. The references keep their spans, shifted past each `!`.
 */
export function assertedValue(value: Expression): Expression {
  const ends = new Set<number>();
  for (const reference of value.refs) {
    if (reference.kind !== "Binding") {
      continue;
    }
    for (const path of reference.narrowed ?? []) {
      if (path.scope === "template") {
        ends.add(path.span.end);
      }
    }
  }
  if (!ends.size) {
    return value;
  }
  const sorted = [...ends].toSorted((a, b) => a - b);
  let code = "";
  let last = value.span.start;
  for (const end of sorted) {
    code += `${value.code.slice(last - value.span.start, end - value.span.start)}!`;
    last = end;
  }
  code += value.code.slice(last - value.span.start);
  const shift = (offset: number) => sorted.filter((end) => end < offset).length;
  return {
    code,
    span: { start: value.span.start, end: value.span.end + sorted.length },
    refs: value.refs.map((reference) => {
      const moved = {
        ...reference,
        span: {
          start: reference.span.start + shift(reference.span.start),
          end: reference.span.end + shift(reference.span.end),
        },
      };
      if (moved.kind === "Binding") {
        delete moved.narrowed;
      }
      return moved;
    }),
  };
}
