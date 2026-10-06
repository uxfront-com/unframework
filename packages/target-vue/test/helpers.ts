import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { formatOutput } from "@unframework/codegen";
import type { EmitContext, OutputFile } from "@unframework/codegen";
import { checkInvariants } from "@unframework/ir";
import type { UfModule } from "@unframework/ir";
import { createSSRApp } from "vue";
import type { Component } from "vue";
import { compileScript, compileTemplate, parse } from "vue/compiler-sfc";
import { renderToString } from "vue/server-renderer";

// The analyser lowers the sources these tests emit from, as the compiler does (a test-only
// import: a target's own code never sees it).
import { analyze } from "../../analyzer/src/index.ts";
import { parseModule } from "../../parser/src/index.ts";
import target from "../src/index.ts";

export const packageDir: string = fileURLToPath(new URL("..", import.meta.url));
export const repoRoot: string = join(packageDir, "../..");
export const casesDir: string = join(repoRoot, "tests/integration/cases");
/** Where vue-tsc is installed, beside the toolchain's tsconfig. */
export const toolchainDir: string = join(repoRoot, "tests/toolchains/vue");

/** Every file under a directory, recursively, as absolute paths. */
function filesUnder(directory: string): string[] {
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .toSorted();
}

/** The committed Vue golden outputs of the integration corpus. */
export function goldenFiles(): string[] {
  return filesUnder(casesDir).filter((path) => /\/__output__\/vue\/[^/]+\.vue$/.test(path));
}

/** Each corpus case's IR snapshot, with the directory its golden outputs live in. */
export function corpus(): { name: string; module: UfModule; outputDir: string }[] {
  return filesUnder(casesDir)
    .filter((path) => path.endsWith("/__output__/ir.json"))
    .map((path) => ({
      name: path.slice(casesDir.length + 1, -"/__output__/ir.json".length),
      module: JSON.parse(readFileSync(path, "utf8")) as UfModule,
      outputDir: join(path, "../vue"),
    }));
}

/** What this target emits for a module, formatted as the compiler formats it. */
export async function emitFormatted(module: UfModule): Promise<OutputFile[]> {
  const context: EmitContext = {
    module,
    options: undefined,
    report: (diagnostic) => {
      throw new Error(`unexpected diagnostic: ${diagnostic.message}`);
    },
  };
  const files = module.components.flatMap((component) => target.emit(component, context));
  return Promise.all(
    files.map(async (file) => {
      const outcome = await formatOutput(file);
      if (outcome.error) throw new Error(`${file.path} does not format: ${outcome.error}`);
      return outcome.file;
    }),
  );
}

/**
 * A source lowered by the analyser: throws on any error, or on IR that breaks an invariant, so
 * a test emits only from IR the compiler would hand the target.
 */
export function lower(source: string, file = "Case.uf.tsx"): UfModule {
  const { module, diagnostics } = analyze(parseModule(file, source));
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  if (!module || errors.length) {
    throw new Error(`the analyser rejects the source: ${errors.map((e) => e.message).join("; ")}`);
  }
  const broken = checkInvariants(module);
  if (broken.length) throw new Error(`invalid IR: ${JSON.stringify(broken)}`);
  return module;
}

/** The single file this target emits for a source's one component, formatted or as printed. */
export async function emitSource(source: string, format = true): Promise<string> {
  const module = lower(source);
  const files = format
    ? await emitFormatted(module)
    : module.components.flatMap((component) =>
        target.emit(component, { module, options: undefined, report: () => {} }),
      );
  if (files.length !== 1) throw new Error(`expected one file, got ${files.length}`);
  return files[0]!.contents;
}

let compiled = 0;

/**
 * Compiles a single-file component as @vitejs/plugin-vue does, `inline` as in a production build
 * (the template inlined into `setup`) or not as under a dev server (a separate render function
 * that reads bindings through `$props` and `$setup`), for the server, or for the DOM with `ssr`
 * false (a client render function, which the server renderer runs too), and renders it with
 * `props` as root props. Fails on any warning from the compiler or from Vue.
 */
export async function renderSfc(
  contents: string,
  props: Record<string, unknown>,
  { inline, ssr = true }: { inline: boolean; ssr?: boolean },
): Promise<string> {
  const id = `sfc-${compiled++}`;
  const filename = `${id}.vue`;
  const { descriptor, errors } = parse(contents, { filename });
  if (errors.length) throw new Error(`parse: ${errors.map(String).join("; ")}`);
  const warnings: string[] = [];
  const warn = console.warn;
  console.warn = (...args: unknown[]) => void warnings.push(args.join(" "));
  let code: string;
  try {
    const onWarn = (warning: { message: string }) => void warnings.push(warning.message);
    const script = descriptor.scriptSetup
      ? compileScript(descriptor, {
          id,
          inlineTemplate: inline,
          templateOptions: {
            ssr,
            ssrCssVars: [],
            transformAssetUrls: false,
            compilerOptions: { onWarn },
          },
        })
      : undefined;
    if (script && inline) code = script.content;
    else {
      const template = compileTemplate({
        source: descriptor.template!.content,
        ast: descriptor.template!.ast,
        filename,
        id,
        ssr,
        ssrCssVars: [],
        transformAssetUrls: false,
        compilerOptions: {
          onWarn,
          ...(script
            ? { bindingMetadata: script.bindings, expressionPlugins: ["typescript"] }
            : {}),
        },
      });
      if (template.errors.length) throw new Error(`template: ${template.errors.join("; ")}`);
      const component = script
        ? script.content.replace("export default ", "const component = ")
        : "const component = {};";
      const render = ssr ? "ssrRender = ssrRender" : "render = render";
      code = `${component}\n${template.code}\ncomponent.${render};\nexport default component;\n`;
    }
  } finally {
    console.warn = warn;
  }
  const { default: component } = await importScratch<{ default: Component }>(`${id}.ts`, code);
  const app = createSSRApp(component, props);
  app.config.warnHandler = (message) => void warnings.push(message);
  const html = await renderToString(app);
  if (warnings.length) throw new Error(`warnings: ${warnings.join("\n")}`);
  return html;
}

const scratch: string[] = [];

/**
 * A fresh directory inside this package (gitignored `.uf-tmp/`), so files written there resolve
 * `vue` like the package itself does. {@link removeScratch} deletes it.
 */
export function scratchDir(): string {
  mkdirSync(join(packageDir, ".uf-tmp"), { recursive: true });
  const directory = mkdtempSync(join(packageDir, ".uf-tmp", "test-"));
  scratch.push(directory);
  return directory;
}

/** Deletes every scratch directory this test file created. */
export function removeScratch(): void {
  for (const directory of scratch.splice(0)) rmSync(directory, { recursive: true, force: true });
}

/** Writes files into a fresh scratch directory and returns their absolute paths by name. */
export function writeScratch(files: Record<string, string>): Record<string, string> {
  const directory = scratchDir();
  return Object.fromEntries(
    Object.entries(files).map(([name, contents]) => {
      const path = join(directory, name);
      writeFileSync(path, contents);
      return [name, path];
    }),
  );
}

/** Imports an ES module written to a scratch file. */
export async function importScratch<T>(name: string, code: string): Promise<T> {
  const { [name]: path } = writeScratch({ [name]: code });
  return (await import(pathToFileURL(path!).href)) as T;
}
