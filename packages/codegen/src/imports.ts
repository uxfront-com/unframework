import type * as AST from "@oxc-project/types";

import { importDeclaration, importDefaultSpecifier, importSpecifier } from "./js/builders.ts";
import { NameScope } from "./names.ts";

interface ModuleImports {
  defaultName?: string;
  names: Map<string, { local: string; type: boolean }>;
  sideEffect: boolean;
}

/**
 * Collects the imports a target's output needs and prints them in a stable order: by module,
 * then by name. Adding the same import twice is a no-op. Local names never collide: with each
 * other, or with the names the module declares itself (a component named `Component` beside
 * Angular's `Component` decorator), which the constructor reserves; a taken name gets the
 * first free `_1`, `_2`… suffix, so the output stays deterministic.
 *
 * Its {@link NameScope} is the output file's: a target reserves the source's names in it
 * (`sourceNames`) and claims its own locals from it (`props`, `cx`), so imports and locals
 * never collide either (design §4.2).
 */
export class ImportSet {
  readonly #modules = new Map<string, ModuleImports>();
  /** The output file's names: imports, reserved source names and claimed locals. */
  readonly scope: NameScope;

  /**
   * `reserved`: the names the module itself declares, which no import may take, or the
   * output file's name scope to share.
   */
  constructor(reserved: Iterable<string> | NameScope = []) {
    this.scope = reserved instanceof NameScope ? reserved : new NameScope(reserved);
  }

  #module(source: string): ModuleImports {
    let entry = this.#modules.get(source);
    if (!entry) {
      entry = { names: new Map(), sideEffect: false };
      this.#modules.set(source, entry);
    }
    return entry;
  }

  /** Marks names as taken, as they are: see {@link NameScope.reserve}. */
  reserve(...names: string[]): void {
    this.scope.reserve(...names);
  }

  /** Takes a free local name for the output's own use: see {@link NameScope.claim}. */
  claim(name: string): string {
    return this.scope.claim(name);
  }

  /**
   * Imports a named binding: `import { name } from "source"`, or `name as local` when its name
   * is taken. Returns the local name to refer to it by.
   */
  add(source: string, name: string, options: { type?: boolean; local?: string } = {}): string {
    const entry = this.#module(source);
    const existing = entry.names.get(name);
    if (existing) {
      existing.type &&= Boolean(options.type);
      return existing.local;
    }
    const local = this.scope.claim(options.local ?? name);
    entry.names.set(name, { local, type: Boolean(options.type) });
    return local;
  }

  /** Imports a default binding: `import local from "source"`. Returns the local name. */
  addDefault(source: string, local: string): string {
    const entry = this.#module(source);
    entry.defaultName ??= this.scope.claim(local);
    return entry.defaultName;
  }

  /** Imports a module for its side effects: `import "source"`. */
  addSideEffect(source: string): void {
    this.#module(source).sideEffect = true;
  }

  get size(): number {
    return this.#modules.size;
  }

  /** The import declarations, sorted by module and name. */
  toDeclarations(): AST.ImportDeclaration[] {
    return [...this.#modules.keys()].toSorted().map((source) => {
      const entry = this.#modules.get(source)!;
      const specifiers: AST.ImportDeclarationSpecifier[] = [];
      if (entry.defaultName) specifiers.push(importDefaultSpecifier(entry.defaultName));
      const names = [...entry.names.entries()].toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
      const allTypes =
        names.length > 0 && names.every(([, value]) => value.type) && !entry.defaultName;
      for (const [name, value] of names) {
        specifiers.push(
          importSpecifier(name, value.local, value.type && !allTypes ? "type" : "value"),
        );
      }
      return importDeclaration(source, specifiers, allTypes ? "type" : "value");
    });
  }
}
