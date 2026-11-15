// Directives (ADR-0099): what every target prints of a directive alike. Its hooks are the
// author's code, copied as written: they read their own parameters, the browser's globals and
// the module's constants and value imports, which keep their names in every output. Each target
// wraps them in its own idiom (Vue's `ObjectDirective`, Svelte's attachment, Solid's ref
// factory, Angular's attribute directive, React's and Qwik's helper).
import { walk } from "@unframework.dev/ir";
import type { DirectiveHook, UfComponent, UfDirective, UfModule } from "@unframework.dev/ir";

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
 * A hook's parameters, typed as `defineDirective`'s type arguments give them: the element, then
 * the value and the previous value, as many as the author wrote.
 */
export function directiveParameters(directive: UfDirective, hook: DirectiveHook): string[] {
  const types = [directiveElement(directive), directive.value.code, directive.value.code];
  return hook.parameters.map((name, index) => `${name}: ${types[index]}`);
}

/**
 * A directive's hooks as a plain object of typed methods, in source order:
 * `{ mounted(el: HTMLElement, value: boolean) { … }, … }`, the author's code as written.
 */
export function directiveHooksObject(directive: UfDirective): string {
  const methods = directive.hooks.map(
    (hook) =>
      `${hook.async ? "async " : ""}${hook.name}(${directiveParameters(directive, hook).join(", ")}): ${hook.async ? "Promise<void>" : "void"} ${hook.body.code}`,
  );
  return `{\n${methods.map((method) => `  ${method},`).join("\n")}\n}`;
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
      if (!values.has(constant.name)) continue;
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
    for (const name of codeNames(hook.body.code, "statements")) named.add(name);
  }
  for (const constant of constants) {
    if (!values.has(constant.name)) continue;
    if (constant.type) for (const name of typeNames(constant.type)) named.add(name);
    for (const name of codeNames(constant.value.code)) named.add(name);
  }
  const declared = new Set<string>();
  for (let size = -1; size !== declared.size;) {
    size = declared.size;
    for (const declaration of module.types) {
      if (declared.has(declaration.name) || !named.has(declaration.name)) continue;
      declared.add(declaration.name);
      for (const name of codeNames(declaration.code, "statements")) named.add(name);
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
    if (!directive.exported) found.set(directive.name, { directive });
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
  return `${hooks}.${hook.name}(${args.slice(0, hook.parameters.length).join(", ")})`;
}

/** The names of the directives a component's elements apply (ADR-0099). */
export function appliedDirectives(component: UfComponent): Set<string> {
  const names = new Set<string>();
  walk(component.render, {
    enter(node) {
      if (node.kind !== "Element") return;
      for (const attribute of node.attributes) {
        if (attribute.kind === "Directive") names.add(attribute.name);
      }
    },
  });
  return names;
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
