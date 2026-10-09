import type * as AST from "@oxc-project/types";
import { walk } from "@unframework/ir";
import type { UfComponent, UfModule } from "@unframework/ir";

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
 * never collide either (ADR-0035).
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
   * is taken. Returns the local name to refer to it by. `exact` keeps a local name the source
   * declares itself (an imported injection key's, ADR-0054), which the scope reserves already.
   */
  add(
    source: string,
    name: string,
    options: { type?: boolean; local?: string; exact?: boolean } = {},
  ): string {
    const entry = this.#module(source);
    const existing = entry.names.get(name);
    if (existing) {
      existing.type &&= Boolean(options.type);
      return existing.local;
    }
    if (options.exact) this.scope.reserve(options.local ?? name);
    const local = options.exact ? (options.local ?? name) : this.scope.claim(options.local ?? name);
    entry.names.set(name, { local, type: Boolean(options.type) });
    return local;
  }

  /**
   * Imports a default binding: `import local from "source"`. Returns the local name. `exact`
   * keeps a name the source declares itself (a child component's local name, ADR-0053), which
   * the scope reserves already.
   */
  addDefault(source: string, local: string, options: { exact?: boolean } = {}): string {
    const entry = this.#module(source);
    if (options.exact) this.scope.reserve(local);
    entry.defaultName ??= options.exact ? local : this.scope.claim(local);
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

/**
 * A component a component's template renders, and how its output imports the child's output
 * (ADR-0053): by the specifier of the child's output file, in the same output tree at the same
 * relative path as the sources, as the default or by name.
 */
export interface ChildImport {
  /** The name the template uses: the import's local name, or a component's own. */
  local: string;
  /** The child's own name, which names its output file. */
  name: string;
  /** `./Field.vue`, `../shared/field`: the child's output file as `file` names it. */
  specifier: string;
  /** How the child's output exports it: a script target keeps the source's export kind. */
  export: "default" | "named";
  /** Whether the component renders itself (recursion). */
  self: boolean;
}

/**
 * The components a component's template renders, each once, in the order the template first
 * names them, with the specifier of each one's output file: `file(name)` is the output file a
 * target names a component's by, without `./` (`Field.vue`, `field`). A child of the same module
 * is a sibling file; the module's non-exported ones are exported by name from it, so their
 * siblings can import them (ADR-0053).
 */
export function childImports(
  component: UfComponent,
  module: UfModule,
  file: (name: string) => string,
): ChildImport[] {
  const used: string[] = [];
  walk(component.render, {
    enter(node) {
      const names =
        node.kind === "Component"
          ? [node.component]
          : node.kind === "Dynamic"
            ? node.candidates.flatMap((each) => (each.kind === "Component" ? [each.component] : []))
            : [];
      for (const name of names) if (!used.includes(name)) used.push(name);
    },
  });
  return used.map((local): ChildImport => {
    for (const entry of module.imports ?? []) {
      const imported = entry.names.find(
        (name) => name.kind === "Component" && name.local === local,
      );
      if (!imported) continue;
      const api = entry.api.components.find((each) =>
        imported.imported === "default"
          ? each.export === "default"
          : each.export === "named" && each.name === imported.imported,
      )!;
      const directory = entry.file.includes("/")
        ? entry.file.slice(0, entry.file.lastIndexOf("/"))
        : "";
      const path = `${directory ? `${directory}/` : ""}${file(api.name)}`;
      return {
        local,
        name: api.name,
        specifier: path.startsWith("../") ? path : `./${path}`,
        export: api.export === "default" ? "default" : "named",
        self: false,
      };
    }
    const exported = module.exports.some(
      (entry) => entry.local === local && entry.kind === "default",
    );
    return {
      local,
      name: local,
      specifier: `./${file(local)}`,
      export: exported ? "default" : "named",
      self: local === component.name,
    };
  });
}

/**
 * The component whose output declares a module's injection keys (ADR-0054): its main one, the
 * default export, else its first exported component, else its first.
 */
export function keyOwner(
  components: readonly { name: string; export?: "default" | "named" | "local" }[],
  exports: readonly { kind: "default" | "named"; local: string }[] = [],
): string | undefined {
  const exported = exports.find((entry) => entry.kind === "default") ?? exports[0];
  if (exported) return exported.local;
  const main =
    components.find((component) => component.export === "default") ??
    components.find((component) => component.export === "named") ??
    components[0];
  return main?.name;
}

/**
 * An injection key a component's setup names (ADR-0054), and the output file it is imported
 * from: each target writes a module's keys into the output of its main component (`keyOwner`).
 */
export interface KeyImport {
  /** The name the setup uses. */
  local: string;
  /** The key's own name, which its module exports. */
  name: string;
  /** `./Tabs.vue`, `./tabs`: absent for a key the component's own output declares. */
  specifier?: string;
}

/**
 * The keys a component's `provide` and `inject` name, each once, in source order, with the
 * output file each is imported from: `file(name)` names a component's output file, as for
 * {@link childImports}.
 */
export function keyImports(
  component: UfComponent,
  module: UfModule,
  file: (name: string) => string,
): KeyImport[] {
  const used: string[] = [];
  for (const item of component.setup) {
    if ((item.kind === "Provide" || item.kind === "Inject") && !used.includes(item.key)) {
      used.push(item.key);
    }
  }
  return used.map((local): KeyImport => {
    for (const entry of module.imports ?? []) {
      const imported = entry.names.find((name) => name.kind === "Key" && name.local === local);
      const owner = keyOwner(entry.api.components);
      if (!imported || owner === undefined) continue;
      const directory = entry.file.includes("/")
        ? entry.file.slice(0, entry.file.lastIndexOf("/"))
        : "";
      const path = `${directory ? `${directory}/` : ""}${file(owner)}`;
      return {
        local,
        name: imported.imported,
        specifier: path.startsWith("../") ? path : `./${path}`,
      };
    }
    const owner = keyOwner(module.components, module.exports)!;
    return owner === component.name
      ? { local, name: local }
      : { local, name: local, specifier: `./${file(owner)}` };
  });
}
