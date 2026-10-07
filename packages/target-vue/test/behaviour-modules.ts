// The Node half of the behaviour tests: a Vite plugin that serves each source of
// ./behaviour-sources.ts as the single-file component this target emits for it (lowered by the
// analyser, formatted as the compiler formats it), under `/__uf_vue_behaviour__/`, so that
// @vitejs/plugin-vue compiles it in the browser project as it compiles the unplugin's output, and
// ./behaviour-manifest.ts, which the plugin replaces with a loader for each.
import { sep } from "node:path";
import { fileURLToPath } from "node:url";

import { formatOutput } from "@unframework/codegen";
import type { Plugin } from "vite";

import target from "../src/index.ts";
import { BEHAVIOUR_SOURCES } from "./behaviour-sources.ts";
import { lower } from "./helpers.ts";

/** The module the browser test imports its loaders from: a real file, for its types. */
const MANIFEST = fileURLToPath(new URL("behaviour-manifest.ts", import.meta.url))
  .split(sep)
  .join("/");
/** Where the emitted components live, under the Vite root (no file is ever written there). */
const DIRECTORY = "/__uf_vue_behaviour__/";

/** What this target emits for one behaviour source, formatted. */
export async function emitBehaviour(name: string): Promise<string> {
  const source = BEHAVIOUR_SOURCES[name];
  if (source === undefined) throw new Error(`No behaviour source is named ${name}.`);
  const module = lower(source, `${name}.uf.tsx`);
  const [file, ...rest] = module.components.flatMap((component) =>
    target.emit(component, {
      module,
      options: undefined,
      report: (diagnostic) => {
        throw new Error(`${name}: ${diagnostic.message}`);
      },
    }),
  );
  if (!file || rest.length) throw new Error(`${name}: the target did not emit one file.`);
  const outcome = await formatOutput(file);
  if (outcome.error) throw new Error(`${name} does not format: ${outcome.error}`);
  return outcome.file.contents;
}

/** Serves the behaviour components and their manifest to the browser project. */
export function behaviourModules(): Plugin {
  let root = "";
  const served = (id: string) => {
    const [path = ""] = id.split("?");
    const relative = root && path.startsWith(`${root}/`) ? path.slice(root.length) : path;
    if (!relative.startsWith(DIRECTORY) || !relative.endsWith(".vue")) return undefined;
    const name = relative.slice(DIRECTORY.length, -".vue".length);
    return name in BEHAVIOUR_SOURCES ? { relative, name } : undefined;
  };
  return {
    name: "uf-vue-behaviour",
    enforce: "pre",
    configResolved(config) {
      root = config.root;
    },
    resolveId(source) {
      const path = served(source);
      if (path === undefined) return null;
      // Queries are plugin-vue's requests for parts of the module (`?vue&type=…`).
      const query = source.includes("?") ? source.slice(source.indexOf("?")) : "";
      return `${root}${path.relative}${query}`;
    },
    async load(id) {
      if (id === MANIFEST) {
        const loaders = Object.keys(BEHAVIOUR_SOURCES).map(
          (name) =>
            `${JSON.stringify(name)}: () => import(${JSON.stringify(`${DIRECTORY}${name}.vue`)})`,
        );
        return `export const components = {\n${loaders.join(",\n")}\n};\n`;
      }
      if (id.includes("?")) return null;
      const path = served(id);
      return path === undefined ? null : emitBehaviour(path.name);
    },
  };
}
