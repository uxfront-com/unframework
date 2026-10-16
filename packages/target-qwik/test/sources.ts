// The behaviour tests' sources (test/behaviour/*.uf.tsx), compiled in the browser project by this
// target as the unplugin compiles a module: the analyser's IR, this target's output, formatted,
// which the toolchain's Qwik plugin then compiles like any `.tsx`. Imported by path, as the
// render-parity kit does: a target package depends on ir and codegen only.
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import { formatOutput } from "@unframework/codegen";
import type { ModuleApi } from "@unframework/ir";
import type { Plugin } from "vite";

import { analyze, componentImports } from "../../analyzer/src/index.ts";
import { parseModule } from "../../parser/src/index.ts";
import target from "../src/index.ts";

/**
 * Loads each `.uf.tsx` module as the Qwik component this target emits for it, and resolves an
 * output's child import (`./Groups`), from the module or a segment the optimizer splits off it,
 * to the child's source beside it.
 */
export function ufSources(): Plugin {
  return {
    name: "uf-qwik-sources",
    enforce: "pre",
    resolveId(source, importer) {
      if (!importer?.includes(".uf.tsx") || !/^\.\/[\w-]+$/.test(source)) return null;
      const child = join(dirname(importer.split("?")[0]!), `${source.slice(2)}.uf.tsx`);
      return existsSync(child) ? child : null;
    },
    async load(id) {
      const [path = ""] = id.split("?");
      if (!path.endsWith(".uf.tsx")) return null;
      const parsed = parseModule(basename(path), readFileSync(path, "utf8"));
      // A sibling it imports, by its API as the compiler's resolver gives it (ADR-0053).
      const imports = new Map<string, ModuleApi | undefined>();
      for (const specifier of componentImports(parsed)) {
        const name = specifier.replace(/^\.\//, "");
        const child = join(dirname(path), name);
        const api = existsSync(child)
          ? analyze(parseModule(name, readFileSync(child, "utf8"))).api
          : undefined;
        imports.set(specifier, api && { ...api, file: name });
      }
      const { module, diagnostics } = analyze(parsed, { imports });
      const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "error");
      if (!module || errors.length) {
        throw new Error(
          `${basename(path)} does not compile: ${errors.map((error) => `${error.code} ${error.message}`).join("; ")}`,
        );
      }
      const [component] = module.components;
      const [file] = target.emit(component!, {
        module,
        options: undefined,
        report: (diagnostic) => {
          throw new Error(`${basename(path)}: the target reported ${diagnostic.code}.`);
        },
      });
      const formatted = await formatOutput(file!);
      if (formatted.error) throw new Error(`${basename(path)}: ${formatted.error}`);
      return formatted.file.contents;
    },
  };
}
