import { glob, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { stripVTControlCharacters } from "node:util";

import type { OutputFile } from "@unframework/compiler";

import type { Packager, SubpathExports } from "./packager.ts";
import { dropSideEffectImports, runScript, writeFiles } from "./packager.ts";

const NG_PACKAGR = "ng-packagr/src/cli/main.js";

/** The name inside the format, which a consumer never reads: it imports `<package>/angular`. */
const FORMAT_NAME = "unframework-angular";

/** A slot directive, as the target prints it (ADR-0056), and the alias it may export it under. */
const SLOT_DIRECTIVE =
  /@[\w$]+\(\{\s*selector:\s*"ng-template\[[^\]]+\]",?\s*\}\)\s*(?:export )?class ([\w$]+)/g;
const ALIAS = /^export \{ ([\w$]+) as ([\w$]+) \};$/gm;

/**
 * The barrel and the slot directives of the components it exports. A consumer imports the directive
 * that fills a named slot, and the format's one entry point is all a consumer can reach.
 */
function entryPoint(files: readonly OutputFile[]): string {
  const barrel = files.find(({ path }) => path === "index.ts")?.contents ?? "";
  const directives = files.flatMap(({ path, contents }) => {
    const specifier = JSON.stringify(`./${path.replace(/\.ts$/, "")}`);
    if (!barrel.includes(specifier)) return [];
    const aliases = new Map(
      [...contents.matchAll(ALIAS)].map(([, local, name]) => [local, name] as const),
    );
    return [...contents.matchAll(SLOT_DIRECTIVE)].map(([, local = ""]) => {
      return `export { ${aliases.get(local) ?? local} } from ${specifier};\n`;
    });
  });
  return `${barrel}${directives.toSorted().join("")}`;
}

/** The format's own paths under `./angular`, each condition in the order ng-packagr wrote it. */
function prefixed(exports: SubpathExports): SubpathExports {
  if (typeof exports === "string") return exports.replace(/^\.\//, "./angular/");
  return Object.fromEntries(
    Object.entries(exports).map(([condition, path]) => [condition, prefixed(path)]),
  );
}

/** Plan §8.4: ng-packagr's Angular Package Format, partially compiled for a consumer's linker. */
export const angular: Packager = {
  peer: [
    { name: "@angular/core", range: "^22.0.0" },
    // An output that renders a slot imports `NgTemplateOutlet`.
    { name: "@angular/common", range: "^22.0.0" },
  ],
  needs: [NG_PACKAGR],
  types: "@angular/core",
  exports: async (out) => {
    const { exports } = JSON.parse(await readFile(join(out, "package.json"), "utf8")) as {
      exports?: Record<string, SubpathExports>;
    };
    const entry = exports?.["."];
    if (entry === undefined) throw new Error('ng-packagr wrote no exports["."].');
    return prefixed(entry);
  },
  run: async ({ files, out, work, resolve }) => {
    await writeFiles(join(work, "in"), files);
    await writeFile(join(work, "in", "index.ts"), entryPoint(files));
    await writeFile(
      join(work, "package.json"),
      JSON.stringify({ name: FORMAT_NAME, version: "0.0.0" }),
    );
    await writeFile(
      join(work, "ng-package.json"),
      // A sheet's `url()` stays as written, as on the other targets: the scratch copy has no assets.
      JSON.stringify({ dest: out, lib: { entryFile: "in/index.ts", cssUrl: "none" } }),
    );
    // `noCheck`, as the other packagers write: this scratch project can't see what the project
    // declares, a `virtual:` module or a global, so a check here would refuse correct sources.
    await writeFile(
      join(work, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "es2022",
          module: "preserve",
          moduleResolution: "bundler",
          lib: ["es2024", "dom", "dom.iterable"],
          strict: true,
          skipLibCheck: true,
          noCheck: true,
          types: [],
        },
        angularCompilerOptions: { compilationMode: "partial" },
      }),
    );
    await runScript(
      resolve(NG_PACKAGR),
      ["-p", "ng-package.json", "-c", "tsconfig.json"],
      work,
      "stderr",
    ).catch((error: Error) => {
      // Its spinner's lines, which say nothing about the failure. With colour on, each starts with
      // a control code, so those go first.
      throw new Error(stripVTControlCharacters(error.message).replace(/^[-✖✔] .*\n/gm, ""));
    });
    // ng-packagr always writes maps, and a package ships none (ADR-0077).
    for await (const file of glob("**/*.map", { cwd: out })) {
      await rm(join(out, file));
    }
    for await (const file of glob("**/*.mjs", { cwd: out })) {
      const path = join(out, file);
      const code = await readFile(path, "utf8");
      await writeFile(path, code.replace(/\n\/\/# sourceMappingURL=[^\n]*\n?$/, "\n"));
    }
    for await (const file of glob("**/*.d.ts", { cwd: out })) {
      const path = join(out, file);
      await writeFile(path, dropSideEffectImports(await readFile(path, "utf8")));
    }
  },
};
