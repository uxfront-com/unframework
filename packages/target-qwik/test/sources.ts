// The behaviour tests' sources (test/behaviour/*.uf.tsx), compiled in the browser project by this
// target as the unplugin compiles a module: the analyser's IR, this target's output, formatted,
// which the toolchain's Qwik plugin then compiles like any `.tsx`. Imported by path, as the
// render-parity kit does: a target package depends on ir and codegen only.
import { readFileSync } from "node:fs";
import { basename } from "node:path";

import { formatOutput } from "@unframework/codegen";
import type { Plugin } from "vite";

import { analyze } from "../../analyzer/src/index.ts";
import { parseModule } from "../../parser/src/index.ts";
import target from "../src/index.ts";

/** Loads each `.uf.tsx` module as the Qwik component this target emits for it. */
export function ufSources(): Plugin {
  return {
    name: "uf-qwik-sources",
    enforce: "pre",
    async load(id) {
      const [path = ""] = id.split("?");
      if (!path.endsWith(".uf.tsx")) return null;
      const { module, diagnostics } = analyze(
        parseModule(basename(path), readFileSync(path, "utf8")),
      );
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
