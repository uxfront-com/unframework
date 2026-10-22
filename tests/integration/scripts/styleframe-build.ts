// `node scripts/styleframe-build.ts build <config>`: builds a Styleframe configuration's stylesheet
// and recipes as a production build of a project does (ADR-0064), through Styleframe's own Vite
// plugin, and writes nothing. The plugin checks the licence of a configuration that needs one
// only in a build (it reads `build` from the command line) under NODE_ENV=production, so
// `harness/styleframe.unit.test.ts` runs this in a child process with that environment.
import { build } from "vite";
import type { Plugin } from "vite";

import { ROOT } from "../harness/paths.ts";
import { styleframePlugin } from "../harness/styleframe.ts";

const [command, config] = process.argv.slice(2);
if (command !== "build" || !config) {
  console.error("usage: node scripts/styleframe-build.ts build <styleframe.config.ts>");
  process.exit(2);
}

const ENTRY = "\0uf-styleframe-build";

/** A module that imports both of Styleframe's virtual modules, as a styled output does. */
const entry: Plugin = {
  name: "uf-styleframe-build",
  resolveId: (id) => (id === ENTRY ? id : null),
  load: (id) =>
    id === ENTRY
      ? 'import "virtual:styleframe.css";\nexport * from "virtual:styleframe";\n'
      : null,
};

await build({
  root: ROOT,
  configFile: false,
  logLevel: "silent",
  plugins: [...(await styleframePlugin(config)), entry],
  build: { write: false, rolldownOptions: { input: ENTRY } },
});
