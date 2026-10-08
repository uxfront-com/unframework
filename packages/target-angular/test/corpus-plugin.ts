// The browser project's stand-in for the unframework plugin: it serves this target's output for a
// case of the integration corpus as the virtual module `virtual:uf-angular/<area>/<name>`, which
// the toolchain's ngtsc plugin compiles ahead of time as it compiles the real plugin's output,
// and the events its component declares, as the mount adapter takes them (`MountEvent`), as
// `virtual:uf-angular-events/<area>/<name>`. The output is lowered from the case's source and
// emitted now, so the browser tests judge the emitter as it is, not the committed goldens. A name
// under `probe/` serves a source of lint-probes.ts's M2_SOURCES instead (`probe/ListenerOrder`):
// the shapes a test pins before, or beside, a corpus case.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { formatOutput } from "@unframework/codegen";
import type { Plugin } from "vite";

import { casesDir, emitModule, lower } from "./helpers.ts";
import { M2_SOURCES } from "./lint-probes.ts";

const PREFIX = "virtual:uf-angular/";
const EVENTS = "virtual:uf-angular-events/";
/** The events module of a case: resolved to itself, with a leading NUL as Vite's convention. */
const EVENTS_ID = "\0uf-angular-events:";
/** Where the served modules live, under the Vite root: `<case>/<Name>.uf.tsx.ts`, never on disk. */
const DIRECTORY = "/__uf_corpus__/";

const PROBE = "probe/";

/** A case's component: its file name and its source, from the corpus or from M2_SOURCES. */
function sourceOf(name: string): { file: string; source: string } {
  if (name.startsWith(PROBE)) {
    const file = `${name.slice(PROBE.length)}.uf.tsx`;
    const source = M2_SOURCES[file];
    if (source === undefined) throw new Error(`M2_SOURCES has no ${file}.`);
    return { file, source };
  }
  const file = readdirSync(join(casesDir, name)).find((each) => each.endsWith(".uf.tsx"));
  if (!file) throw new Error(`The case ${name} has no source.`);
  return { file, source: readFileSync(join(casesDir, name, file), "utf8") };
}

/** The plugin, named `unframework` because the toolchain reads `api.getCompiled` from it. */
export function corpusOutputs(): Plugin {
  const compiled = new Map<string, string>();
  let root = "";
  /** The served id of a case: its directory, and its component's file name. */
  const idOf = (name: string) => `${root}${DIRECTORY}${name}/${sourceOf(name).file}.ts`;
  return {
    name: "unframework",
    enforce: "pre",
    api: { getCompiled: (id: string) => compiled.get(id) },
    configResolved(config) {
      root = config.root;
    },
    resolveId(source) {
      if (source.startsWith(EVENTS)) return `${EVENTS_ID}${source.slice(EVENTS.length)}`;
      return source.startsWith(PREFIX) ? idOf(source.slice(PREFIX.length)) : null;
    },
    async load(id) {
      if (id.startsWith(EVENTS_ID)) {
        const { file, source } = sourceOf(id.slice(EVENTS_ID.length));
        const module = lower(source, file, true);
        const events = (module.components[0]?.emits?.events ?? []).map((event) => ({
          name: event.name,
          optional: event.parameters.map((parameter) => parameter.optional === true),
        }));
        return `export default ${JSON.stringify(events)};\n`;
      }
      if (!id.includes(DIRECTORY)) return null;
      const name = id.slice(id.indexOf(DIRECTORY) + DIRECTORY.length, id.lastIndexOf("/"));
      const { file, source } = sourceOf(name);
      // A case may show a warning on purpose (`semantics/setup-once`'s UF2007).
      const module = lower(source, file, true);
      const [output, ...more] = emitModule(module);
      if (!output || more.length) throw new Error(`${name} does not emit one file.`);
      const { file: formatted, error } = await formatOutput(output);
      if (error) throw new Error(`${name} does not format: ${error}`);
      compiled.set(id, formatted.contents);
      return formatted.contents;
    },
  } as Plugin;
}
