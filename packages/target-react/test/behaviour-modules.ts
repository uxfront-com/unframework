// Serves test/behaviour-sources.ts to the browser project (Node): each source is compiled through
// the analyser and this target, formatted as the compiler formats it, and served as a `.tsx`
// module under `/__uf_behaviour__/`, which `@vitejs/plugin-react` then transforms as it would the
// unplugin's output. A test-only path to the analyser, as test/fixtures.ts takes.
import { formatOutput } from "@unframework/codegen";
import type { Plugin } from "vite";

import { analyze } from "../../analyzer/src/index.ts";
import { parseModule } from "../../parser/src/index.ts";
import target from "../src/index.ts";
import { BEHAVIOUR_SOURCES } from "./behaviour-sources.ts";

/** Where the browser imports a behaviour component from: `${BEHAVIOUR_DIRECTORY}Phases.tsx`. */
export const BEHAVIOUR_DIRECTORY = "/__uf_behaviour__/";

/** The React output of one behaviour source, which the analyser must accept without a diagnostic. */
export async function behaviourModule(name: string): Promise<string> {
  const source = BEHAVIOUR_SOURCES[name];
  if (source === undefined) throw new Error(`No behaviour source is named ${name}.`);
  const { module, diagnostics } = analyze(parseModule(`${name}.uf.tsx`, source));
  if (!module || diagnostics.length) {
    const messages = diagnostics.map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`);
    throw new Error(`The analyser rejected ${name}:\n${messages.join("\n")}`);
  }
  const [file, ...rest] = target.emit(module.components[0]!, {
    module,
    options: undefined,
    report: (diagnostic) => {
      throw new Error(`The React target reported ${diagnostic.code} on ${name}.`);
    },
  });
  if (!file || rest.length) throw new Error(`The React target did not emit one file for ${name}.`);
  const outcome = await formatOutput(file);
  if (outcome.error) throw new Error(`oxfmt failed on ${name}: ${outcome.error}`);
  return outcome.file.contents;
}

/** The behaviour component an id or a URL names, or `undefined` when it names none. */
function componentName(id: string): string | undefined {
  const [path = ""] = id.split("?");
  const at = path.indexOf(BEHAVIOUR_DIRECTORY);
  return at === -1 ? undefined : path.slice(at + BEHAVIOUR_DIRECTORY.length).replace(/\.tsx$/, "");
}

/** The Vite plugin that serves the behaviour components. */
export function behaviourModules(): Plugin {
  let root = "";
  const name = componentName;
  return {
    name: "uf-react-behaviour",
    enforce: "pre",
    configResolved(config) {
      root = config.root;
    },
    resolveId(source) {
      const found = name(source);
      return found === undefined ? null : `${root}${BEHAVIOUR_DIRECTORY}${found}.tsx`;
    },
    load(id) {
      if (id.includes("?")) return null;
      const found = name(id);
      return found === undefined ? null : behaviourModule(found);
    },
  };
}
