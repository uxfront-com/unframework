import { expressionsOf } from "@unframework/ir";
import type { UfComponent, UfModule } from "@unframework/ir";

import { expressionNames } from "./rewrite.ts";

/** `HelloWorld` → `hello-world`; also splits acronyms: `HTMLView` → `html-view`. */
export function kebabCase(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

/** `hello-world` or `helloWorld` → `HelloWorld`. */
export function pascalCase(name: string): string {
  return name
    .replace(/[-_\s]+(.)?/g, (_, next: string | undefined) => (next ? next.toUpperCase() : ""))
    .replace(/^./, (first) => first.toUpperCase());
}

/**
 * The names an output file may declare without capturing or shadowing another (design §4.2).
 * A target reserves what the source declares or reads (see {@link sourceNames}), then claims
 * each name it introduces itself: `props`, `rawProps`, an inline helper (`cx`), an import
 * (`Show`, `CSSProperties`). A taken name gets the first free `_1`, `_2`… suffix, so the output
 * stays deterministic (P8).
 */
export class NameScope {
  readonly #taken: Set<string>;

  constructor(reserved: Iterable<string> = []) {
    this.#taken = new Set(reserved);
  }

  /** Marks names as taken, as they are: the source's own names, which never change. */
  reserve(...names: string[]): void {
    for (const name of names) this.#taken.add(name);
  }

  /** Whether a name is taken. */
  has(name: string): boolean {
    return this.#taken.has(name);
  }

  /** Takes `name`, or `name_1`, `name_2`… when it is taken. Returns the name taken. */
  claim(name: string): string {
    let local = name;
    for (let suffix = 1; this.#taken.has(local); suffix++) local = `${name}_${suffix}`;
    this.#taken.add(local);
    return local;
  }
}

/**
 * Every name a component's output must leave alone: the component's own name, the module's
 * type declarations, the props parameter, every binding, and every variable any of its
 * expressions reads or declares (globals and arrow parameters included). A target that
 * introduced one of these (`props` beside an arrow parameter `props`, an import named like a
 * local interface) would capture a reference or fail to type-check, so it reserves them all
 * before it claims a name of its own (design §4.2).
 */
export function sourceNames(component: UfComponent, module: UfModule): Set<string> {
  const names = new Set<string>([component.name]);
  for (const declaration of module.types) names.add(declaration.name);
  if (component.propsParameter?.name) names.add(component.propsParameter.name);
  for (const binding of component.bindings) names.add(binding.name);
  for (const { expression } of expressionsOf(component)) {
    for (const name of expressionNames(expression.code)) names.add(name);
  }
  return names;
}
