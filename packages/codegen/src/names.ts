import { codeOf, expressionsOf, functionsOf } from "@unframework/ir";
import type { TypeText, UfComponent, UfModule } from "@unframework/ir";

import { parseStatementsSource } from "./parse.ts";
import { codeKind, codeNames, collectNames, expressionNames } from "./rewrite.ts";

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
 * The names an output file may declare without capturing or shadowing another (ADR-0035).
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
 * type declarations, the props parameter, every binding, every variable any of its expressions
 * and its setup code reads or declares (globals, arrow parameters and a function's locals
 * included), the parameters of its functions, and the types its setup's annotations name
 * (`MouseEvent`, `HTMLInputElement`). A target that introduced one of these (`props` beside an
 * arrow parameter `props`, `setCount` beside a local of that name, an import named like a type
 * an annotation reads) would capture a reference or fail to type-check, so it reserves them all
 * before it claims a name of its own (ADR-0035, ADR-0045).
 */
export function sourceNames(component: UfComponent, module: UfModule): Set<string> {
  const names = new Set<string>([component.name]);
  const add = (found: Iterable<string>) => {
    for (const name of found) names.add(name);
  };
  for (const declaration of module.types) names.add(declaration.name);
  if (component.propsParameter?.name) names.add(component.propsParameter.name);
  for (const binding of component.bindings) names.add(binding.name);
  for (const { expression } of expressionsOf(component)) add(expressionNames(expression.code));
  for (const { code } of codeOf(component)) add(codeNames(code.code, codeKind(code, component)));
  for (const { function: fn } of functionsOf(component)) {
    for (const parameter of fn.parameters) {
      if (parameter.name !== undefined) names.add(parameter.name);
      add(parameter.pattern?.names ?? []);
      if (parameter.default) add(expressionNames(parameter.default.code));
      if (parameter.type) add(typeNames(parameter.type));
    }
    if (fn.returnType) add(typeNames(fn.returnType));
  }
  for (const item of component.setup) {
    if ("type" in item && item.type) add(typeNames(item.type));
  }
  if (component.emits) {
    add(typeNames(component.emits.type));
    for (const event of component.emits.events) {
      for (const parameter of event.parameters) add(typeNames(parameter.type));
    }
  }
  return names;
}

/**
 * The names a type annotation reads (`Item` and `Map` in `Map<string, Item>`), not its members'
 * keys or its tuple members' labels. The annotation is parsed as a function's return type, the
 * one position that also admits a type predicate (`value is Size`, `asserts value is Size`,
 * `asserts value`), whose parameter is no type name.
 */
export function typeNames(type: TypeText | string): Set<string> {
  const code = typeof type === "string" ? type : type.code;
  const [statement] = parseStatementsSource(`function value(): ${code} {}`).statements;
  const names = new Set<string>();
  if (statement?.type === "FunctionDeclaration") {
    collectNames(statement.returnType?.typeAnnotation, names);
  }
  return names;
}
