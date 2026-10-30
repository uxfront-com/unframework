import {
  analyze,
  componentImports,
  shapeQueries,
  sharedModuleImports,
  stylesheetImports,
} from "@unframework/analyzer";
import type { SharedModule, StylesheetSource } from "@unframework/analyzer";
import { formatOutput, kebabCase, scopeStylesheet } from "@unframework/codegen";
import type { OutputFile, Target } from "@unframework/codegen";
import { createDiagnostic, sortDiagnostics } from "@unframework/diagnostics";
import type { Diagnostic } from "@unframework/diagnostics";
import { checkInvariants, validateModule } from "@unframework/ir";
import type { IrValidationError, ModuleApi, Span, UfComponent, UfModule } from "@unframework/ir";
import { parseModule } from "@unframework/parser";
import type { AST, ParsedModule } from "@unframework/parser";
import { createSyntacticOracle } from "@unframework/type-oracle";
import type { TypeOracle, TypeShape } from "@unframework/type-oracle";

import { checkCapabilities } from "./capabilities.ts";
import { isSpanIn, pluginIrProblems } from "./plugin-ir.ts";
import { directoryOf, joinPath, relativePath, stylesheetSource } from "./resolver.ts";
import type { Resolver } from "./resolver.ts";
import { resolveTarget } from "./targets.ts";
import type { TargetName } from "./targets.ts";

/** What an `output` plugin hook receives besides the files. */
export interface OutputHookContext {
  target: string;
  component: UfComponent;
  module: UfModule;
}

/**
 * A compiler plugin (plan §5.10). Hooks are pure: the module and the files they receive are
 * frozen, so a hook returns a new value to change them. A hook that throws, or returns a value
 * that is not valid IR (by its schema and its invariants, `checkInvariants`) or a list of
 * files, becomes a UF8001 diagnostic and its step is left out. An `ir` hook's module also keeps
 * the analysed file and every span in the source, and holds only expressions, type annotations
 * and type declarations the analyser produced: it may move, copy or drop analysed code, never
 * write its own.
 */
export interface CompilerPlugin {
  name: string;
  /** Transforms the IR after analysis. Return a new module, or nothing to keep it. */
  ir?(module: UfModule): UfModule | void;
  /** Transforms one component's files for one target, before formatting. */
  output?(files: readonly OutputFile[], context: OutputHookContext): OutputFile[] | void;
}

/** Options for {@link compile}. */
export interface CompileOptions {
  /**
   * The file name as it appears in the IR and in diagnostics. Pass a project-relative path
   * with forward slashes for output that does not depend on the machine.
   */
  filename: string;
  /** The targets to emit, by name or as target objects. */
  targets: readonly (TargetName | Target)[];
  /** Formats the output with oxfmt. Defaults to `true`; the dev server may skip it. */
  format?: boolean;
  plugins?: readonly CompilerPlugin[];
  /** Each target's options, by target name. */
  targetOptions?: Readonly<Record<string, unknown>>;
  /**
   * Resolves an imported `.uf.tsx` module to its public API (ADR-0053): `createFileResolver`
   * reads files. `importer` is `filename`. It is pure and deterministic (P8): it analyses the
   * child's declarations, never compiles it, so the output depends only on the source, the
   * options and what it returns. Without it, or when it returns nothing, the import is UF1202;
   * a resolver that throws is UF9001 as well. Its `stylesheet` reads each stylesheet the source
   * imports (ADR-0063): without it, or when it returns nothing, the import is UF5005. Its `module`
   * reads each shared `.ts` module the source imports (ADR-0070): without it, or when it returns
   * nothing, a value import of one is UF1202.
   */
  resolve?: Resolver;
  /**
   * The specifier prefixes whose imports pass through to every output as written (plan §4.4,
   * ADR-0064): a styling engine's virtual modules, which its own bundler plugin resolves. It
   * defaults to `["virtual:"]`, Vite's convention for a module a plugin registers, and a list
   * replaces the default (`["virtual:", "styled-system/"]`). A prefix that is empty, relative or
   * absolute throws (`checkPassThrough`). An import the analyser classifies itself (the
   * authoring API, a framework, a `.uf.tsx` or relative module) never passes through.
   */
  passThrough?: readonly string[];
  /**
   * The type oracle the props, events, models, slots and injection keys' types are resolved
   * through (plan §5.5, ADR-0067): `compile()` asks it for each type the analyser reads before it
   * analyses, as it asks the resolver for each child's API. Its queries name files relative to its
   * root, so `filename` is relative to that root too. Without it, `compile()` uses an in-process
   * syntactic oracle over the one source, which reads no file: a type imported from another
   * module is UF6001. An oracle that throws is UF9001 as well. It reads the source's own file
   * too, so it must hold the text given here. The caller owns it, and disposes of it.
   */
  typeOracle?: TypeOracle;
}

/**
 * Checks the `passThrough` option (ADR-0064): throws when a prefix is empty, or starts with `.`,
 * `/`, `\\` or a drive letter, since such a specifier names a file of the project, a component's
 * own sheet or a child, never a module a plugin registers.
 */
export function checkPassThrough(prefixes: readonly string[]): void {
  for (const prefix of prefixes) {
    if (typeof prefix !== "string" || !prefix || /^(?:[./\\]|[A-Za-z]:)/.test(prefix)) {
      throw new TypeError(
        `The passThrough prefix ${JSON.stringify(prefix)} is invalid: a prefix that passes through names a module a bundler plugin registers, such as "virtual:", so it is not empty, relative or absolute.`,
      );
    }
  }
}

/** The result of {@link compile}. */
export interface CompileResult {
  filename: string;
  /** The module's IR (frozen), or `undefined` when module-level errors stop compilation. */
  ir: UfModule | undefined;
  /** Every diagnostic, sorted. Portability diagnostics carry their target. */
  diagnostics: Diagnostic[];
  /**
   * Each target's files, by target name, in the order of `targets`: each component's, then a copy
   * of each shared `.ts` module the source reaches, unchanged, at its path relative to the source
   * (ADR-0070).
   */
  outputs: Record<string, OutputFile[]>;
  /**
   * The component each output file is written for, by target name, then by the file's path, or
   * the composable for a `.uf.ts` source's: the unplugin loads a file's components under ids of
   * their own (ADR-0053). The scoped sheet, `<source>.css`, is no component's module, and is left
   * out (ADR-0063).
   */
  owners: Record<string, Record<string, string>>;
  /**
   * What the compile read besides the source, sorted, each once (ADR-0071): the files the type
   * oracle read or looked for, relative to its root, the shared `.ts` modules the resolver read,
   * named as `filename` is, the `.uf.ts` modules whose composables the source imports, named so
   * too (ADR-0069), and the packages, as `pkg:<name>`, one that is not installed included. Never
   * an absolute path (P8).
   */
  dependencies: string[];
}

/**
 * Compiles one `.uf.tsx` source, or a `.uf.ts` module of composables (ADR-0069), to every
 * selected target. A pure function of the source and
 * the options: the same input and versions give byte-identical output (P8). It throws only
 * for invalid options (an unknown target name, two targets with one name, an invalid
 * `passThrough` prefix); every other
 * problem, a misbehaving plugin or target included, is a diagnostic, and an error in one
 * component or target never stops the others.
 */
export async function compile(source: string, options: CompileOptions): Promise<CompileResult> {
  const file = options.filename;
  if (options.passThrough) checkPassThrough(options.passThrough);
  const diagnostics: Diagnostic[] = [];
  const targets = options.targets.map(resolveTarget);
  const outputs: Record<string, OutputFile[]> = {};
  const owners: Record<string, Record<string, string>> = {};
  for (const target of targets) {
    if (Object.hasOwn(outputs, target.name)) {
      throw new TypeError(`Two targets are named "${target.name}".`);
    }
    outputs[target.name] = [];
    owners[target.name] = {};
  }

  // The analyser's module, frozen: every plugin's module is compared with it, whatever the
  // plugins before it returned.
  let analysed: UfModule | undefined;
  /** Each stylesheet's file, by its specifier, as the resolver named it. */
  let sheetFiles = new Map<string, string>();
  const dependencies = new Set<string>();
  /**
   * Each shared `.ts` module's text, by its path relative to the source, with the specifier of
   * the source's import that first reaches it (ADR-0070).
   */
  const copies = new Map<string, Copy>();
  try {
    const parsed = parseModule(file, source);
    // Each type the analyser reads, resolved before it analyses: the analyser is synchronous,
    // and the oracle is not (ADR-0067).
    const oracle = options.typeOracle ?? sourceOracle(file, source);
    const shapes = new Map<string, TypeShape>();
    for (const query of shapeQueries(parsed)) {
      try {
        const shape = await oracle.resolveShape(query);
        shapes.set(`${query.span.start}:${query.span.end}`, shape);
        for (const dependency of shape.dependencies) dependencies.add(dependency);
      } catch (error) {
        const type = source.slice(query.span.start, query.span.end);
        diagnostics.push(internal(file, error, `The type oracle failed on \`${type}\``));
      }
    }
    const imports = new Map<string, ModuleApi | undefined>();
    for (const specifier of options.resolve ? componentImports(parsed) : []) {
      try {
        const api = await options.resolve!({ specifier, importer: file });
        imports.set(specifier, api);
        // A caller's output depends on its composables' APIs, which the project graph watches
        // (ADR-0069, ADR-0071).
        const composable =
          api && COMPOSABLE_SPECIFIER.test(specifier)
            ? joinPath(directoryOf(file), `./${api.file}`)
            : undefined;
        if (composable !== undefined) dependencies.add(composable);
      } catch (error) {
        imports.set(specifier, undefined);
        diagnostics.push(internal(file, error, `The resolver failed on "${specifier}"`));
      }
    }
    const stylesheets = new Map<string, StylesheetSource | undefined>();
    for (const specifier of stylesheetImports(parsed)) {
      try {
        const sheet = await options.resolve?.stylesheet?.({ specifier, importer: file });
        stylesheets.set(specifier, sheet && stylesheetSource(sheet.file, sheet.source));
      } catch (error) {
        stylesheets.set(specifier, undefined);
        diagnostics.push(internal(file, error, `The resolver failed on "${specifier}"`));
      }
    }
    sheetFiles = new Map(
      [...stylesheets].flatMap(([specifier, sheet]) => (sheet ? [[specifier, sheet.file]] : [])),
    );
    const modules = new Map<string, SharedModule | undefined>();
    const fromSource = (path: string) => relativePath(directoryOf(file), path);
    for (const specifier of options.resolve?.module ? sharedModuleImports(parsed) : []) {
      try {
        const resolved = await options.resolve!.module!({ specifier, importer: file });
        if (!resolved?.files.length) {
          modules.set(specifier, undefined);
          continue;
        }
        const { framework, unresolved } = resolved;
        modules.set(specifier, {
          file: fromSource(resolved.files[0]!.file),
          ...(framework ? { framework: { ...framework, file: fromSource(framework.file) } } : {}),
          ...(unresolved
            ? { unresolved: { ...unresolved, file: fromSource(unresolved.file) } }
            : {}),
        });
        const at = parsed.program.body.find(
          (statement): statement is AST.ImportDeclaration =>
            statement.type === "ImportDeclaration" && statement.source.value === specifier,
        )!.source;
        for (const { file: path, source: text } of resolved.files) {
          dependencies.add(path);
          if (!copies.has(fromSource(path))) {
            copies.set(fromSource(path), {
              contents: text,
              span: { start: at.start, end: at.end },
            });
          }
        }
      } catch (error) {
        modules.set(specifier, undefined);
        diagnostics.push(internal(file, error, `The resolver failed on "${specifier}"`));
      }
    }
    // An import that closes a cycle (UF1205), which the resolver's project finds, not the
    // analyser: the modules of a cycle cannot each load before the others (ADR-0071).
    const cycles: Diagnostic[] = [];
    for (const { specifier, span } of options.resolve?.cycle ? relativeImports(parsed) : []) {
      try {
        const files = await options.resolve!.cycle!({ specifier, importer: file });
        if (files) cycles.push(importCycle(file, specifier, span, files));
      } catch (error) {
        diagnostics.push(internal(file, error, `The resolver failed on "${specifier}"`));
      }
    }
    const analysis = analyze(parsed, {
      imports,
      modules,
      stylesheets,
      shapes: (span) => shapes.get(`${span.start}:${span.end}`),
      ...(options.passThrough ? { passThrough: options.passThrough } : {}),
    });
    diagnostics.push(...analysis.diagnostics);
    // The analyser keeps the IR's invariants by construction; a module that breaks one is a
    // compiler bug, and no target may emit from it.
    const broken = analysis.module && checkInvariants(analysis.module);
    if (broken?.length) {
      diagnostics.push(internal(file, describeProblems(broken), "The analyser lowered invalid IR"));
    } else {
      analysed = analysis.module && deepFreeze(analysis.module);
    }
    // A copy named like a component's output, or a cycle, withholds the module, as an analyser
    // error does.
    const collisions = analysed ? copyCollisions(analysed, copies, file) : [];
    diagnostics.push(...collisions, ...cycles);
    if (collisions.length || cycles.length) analysed = undefined;
  } catch (error) {
    diagnostics.push(internal(file, error, "The analyser failed"));
  }

  let module = analysed;
  for (const plugin of options.plugins ?? []) {
    if (!module || !analysed || !plugin.ir) continue;
    try {
      const result = plugin.ir(module);
      if (result === undefined) continue;
      const problems = validateModule(result);
      // Only a module of the schema's shape can be walked for its invariants.
      if (!problems.length) {
        problems.push(...checkInvariants(result), ...pluginIrProblems(result, analysed, source));
      }
      if (problems.length) {
        const what = `returned invalid IR: ${describeProblems(problems)}`;
        diagnostics.push(pluginFailed(file, plugin.name, "ir", what));
        continue;
      }
      module = deepFreeze(result);
    } catch (error) {
      diagnostics.push(pluginFailed(file, plugin.name, "ir", `threw: ${messageOf(error)}`));
    }
  }

  // The scoper runs once per sheet, on the module the targets emit from: after the plugins' `ir`
  // hooks, which may keep or drop the analyser's sheets, never change them (ADR-0063). A
  // selector it rejects (UF5004) withholds the module from every target, as an analyser error
  // does.
  /** Each styled component's scoped sheets, joined in import order, by its name. */
  const sheets = new Map<string, string>();
  for (const component of module?.components ?? []) {
    let joined = "";
    for (const sheet of component.styles ?? []) {
      const sheetFile = sheetFiles.get(sheet.specifier) ?? sheet.specifier;
      const scoped = scopeStylesheet(sheetFile, sheet.source, component.scopeId!);
      diagnostics.push(...scoped.diagnostics);
      if (scoped.diagnostics.length) module = undefined;
      joined += joined && !joined.endsWith("\n") ? `\n${scoped.code}` : scoped.code;
    }
    if (component.styles?.length) sheets.set(component.name, joined);
  }

  if (module) {
    for (const target of targets) {
      try {
        const emitted = await emitTarget(
          target,
          module,
          source,
          options,
          diagnostics,
          sheets,
          copies,
        );
        outputs[target.name] = emitted.files;
        owners[target.name] = emitted.owners;
      } catch (error) {
        diagnostics.push(internal(file, error, `The ${target.name} target failed`, target.name));
      }
    }
  }

  return {
    filename: file,
    ir: module,
    diagnostics: sortDiagnostics(diagnostics),
    outputs,
    owners,
    dependencies: [...dependencies].toSorted(),
  };
}

/** An import of a `.uf.ts` module's composables (ADR-0069). */
const COMPOSABLE_SPECIFIER = /\.uf\.ts$/;

/**
 * The type oracle `compile()` uses without one (ADR-0067): the syntactic adapter over the one
 * source, at the root of a project that holds nothing else, so it reads no file and resolves
 * the module's own types only.
 */
function sourceOracle(file: string, source: string): TypeOracle {
  return createSyntacticOracle({
    root: "",
    readFile: async (path) => (path === `/${file}` ? source : undefined),
  });
}

/**
 * The shared modules whose copy would take a component's output file (UF1104, ADR-0070): an
 * output imports a component's file by its name without the extension (`./CardIcon`), React,
 * Solid and Qwik name it as the component and Angular in kebab-case, and the output tree holds
 * the module's own components and every child it imports. So a copy whose path, without `.ts`,
 * is one of those names, compared without case, is reported for every target, since the module
 * compiles to each.
 */
function copyCollisions(
  module: UfModule,
  copies: ReadonlyMap<string, Copy>,
  file: string,
): Diagnostic[] {
  const names = new Map<string, string>();
  const add = (directory: string, name: string) => {
    for (const stem of [name, kebabCase(name)]) {
      names.set(`${directory}${stem}`.toLowerCase(), name);
    }
  };
  for (const component of module.components) add("", component.name);
  for (const entry of module.imports ?? []) {
    const slash = entry.file.lastIndexOf("/");
    for (const component of entry.api.components) {
      add(slash === -1 ? "" : entry.file.slice(0, slash + 1), component.name);
    }
  }
  return [...copies].flatMap(([path, { span }]) => {
    const name = names.get(path.replace(/\.ts$/, "").toLowerCase());
    if (name === undefined) return [];
    return [
      createDiagnostic("UF1104", {
        file,
        span,
        message: `The shared module ${path} is named like ${name}'s output file, which an output imports without its extension (\`${name}\`, and \`${kebabCase(name)}\` on Angular): each output tree holds the module's copy beside the components.`,
        help: "Rename the shared module, or the component.",
      }),
    ];
  });
}

/**
 * The source's relative imports and re-exports, each specifier once with the span of its first
 * declaration's specifier: the edges a cycle may close (ADR-0071). A sheet's import is no module's.
 */
function relativeImports(parsed: ParsedModule): { specifier: string; span: Span }[] {
  const found = new Map<string, Span>();
  for (const statement of parsed.program.body) {
    const from =
      statement.type === "ImportDeclaration" ||
      statement.type === "ExportAllDeclaration" ||
      statement.type === "ExportNamedDeclaration"
        ? statement.source
        : null;
    if (!from || typeof from.value !== "string" || found.has(from.value)) continue;
    if (!from.value.startsWith("./") && !from.value.startsWith("../")) continue;
    found.set(from.value, { start: from.start, end: from.end });
  }
  return [...found].map(([specifier, span]) => ({ specifier, span }));
}

/** UF1205 at an import that closes a cycle, which names its files relative to the source. */
function importCycle(file: string, specifier: string, span: Span, files: string[]): Diagnostic {
  const names = files.map((path) => relativePath(directoryOf(file), path));
  return createDiagnostic("UF1205", {
    file,
    span,
    message: `"${specifier}" closes an import cycle, ${names.join(" → ")}: none of its modules can load before the others.`,
    help: "Move what the modules of the cycle share into a module that imports none of them.",
  });
}

/** A shared module's copy (ADR-0070), and the specifier of the import that first reaches it. */
interface Copy {
  contents: string;
  span: { start: number; end: number };
}

/**
 * Checks a target's capabilities, then emits, transforms and formats each component's files.
 * A styled component's files end with its scoped sheet, `<source>.css` (ADR-0063), which the
 * `output` hooks see and formatting keeps as printed, and which `owners` leaves out: the
 * unplugin serves it on an id of its own. The files of two components, or two files of one,
 * may not share a path, compared without case: case-insensitive file systems would write one
 * over the other. Each shared `.ts` module's copy follows, unchanged, where a component's files
 * were written: neither the hooks nor formatting see it, and `owners` leaves it out (ADR-0070).
 */
async function emitTarget(
  target: Target,
  module: UfModule,
  source: string,
  options: CompileOptions,
  diagnostics: Diagnostic[],
  sheets: ReadonlyMap<string, string>,
  copies: ReadonlyMap<string, Copy>,
): Promise<{ files: OutputFile[]; owners: Record<string, string> }> {
  const file = options.filename;
  const sheetPath = `${file.slice(file.lastIndexOf("/") + 1)}.css`;
  diagnostics.push(...checkCapabilities(module, target));
  const written: OutputFile[] = [];
  const owners = new Map<string, { path: string; component: string }>();
  for (const component of module.components) {
    let files: readonly OutputFile[];
    try {
      const emitted = readFiles(
        target.emit(component, {
          module,
          options: options.targetOptions?.[target.name],
          report: (diagnostic) => diagnostics.push(reported(diagnostic, source, file, target.name)),
        }),
      );
      if ("problem" in emitted) throw new TypeError(`emit returned ${emitted.problem}`);
      const sheet = sheets.get(component.name);
      if (sheet !== undefined) emitted.files.push({ path: sheetPath, contents: sheet });
      files = deepFreeze(emitted.files);
    } catch (error) {
      const what = `The ${target.name} target failed on ${component.name}`;
      diagnostics.push(internal(file, error, what, target.name));
      continue;
    }

    for (const plugin of options.plugins ?? []) {
      if (!plugin.output) continue;
      try {
        const result: unknown = plugin.output(files, { target: target.name, component, module });
        if (result === undefined) continue;
        const returned = readFiles(result);
        if ("problem" in returned) {
          const what = `returned ${returned.problem}`;
          diagnostics.push(pluginFailed(file, plugin.name, "output", what, target.name));
          continue;
        }
        files = deepFreeze(returned.files);
      } catch (error) {
        diagnostics.push(
          pluginFailed(file, plugin.name, "output", `threw: ${messageOf(error)}`, target.name),
        );
      }
    }

    if (options.format !== false) {
      const formatted = await Promise.all(files.map((output) => formatOutput(output)));
      files = formatted.map((outcome) => {
        if (outcome.error) {
          const what = `The ${target.name} target emitted ${outcome.file.path}, which does not parse`;
          diagnostics.push(internal(file, outcome.error, what, target.name));
        }
        return outcome.file;
      });
    }

    for (const output of files) {
      const key = output.path.toLowerCase();
      const owner = owners.get(key);
      if (owner) {
        diagnostics.push(
          internal(
            file,
            `${owner.path} (${owner.component}) and ${output.path} (${component.name}) are one file on a case-insensitive file system`,
            `The ${target.name} target wrote two files at one path`,
            target.name,
          ),
        );
        continue;
      }
      owners.set(key, { path: output.path, component: component.name });
      written.push(output);
    }
  }
  // A `.uf.ts` module's composables, each one module (ADR-0069). The `output` hooks are a
  // component's, so they see none of it.
  for (const composable of module.composables ?? []) {
    if (!target.emitComposable) {
      diagnostics.push(
        createDiagnostic("UF1002", {
          file,
          span: composable.span,
          message: `The ${target.name} target does not emit a composable yet: it lands with this target's composables lane.`,
          target: target.name,
        }),
      );
      continue;
    }
    let files: OutputFile[];
    try {
      const emitted = readFiles(
        target.emitComposable(composable, {
          module,
          options: options.targetOptions?.[target.name],
          report: (diagnostic) => diagnostics.push(reported(diagnostic, source, file, target.name)),
        }),
      );
      if ("problem" in emitted) throw new TypeError(`emitComposable returned ${emitted.problem}`);
      files = emitted.files;
    } catch (error) {
      const what = `The ${target.name} target failed on ${composable.name}`;
      diagnostics.push(internal(file, error, what, target.name));
      continue;
    }
    if (options.format !== false) {
      const formatted = await Promise.all(files.map((output) => formatOutput(output)));
      files = formatted.map((outcome) => {
        if (outcome.error) {
          const what = `The ${target.name} target emitted ${outcome.file.path}, which does not parse`;
          diagnostics.push(internal(file, outcome.error, what, target.name));
        }
        return outcome.file;
      });
    }
    for (const output of files) {
      const key = output.path.toLowerCase();
      const owner = owners.get(key);
      if (owner) {
        diagnostics.push(
          internal(
            file,
            `${owner.path} (${owner.component}) and ${output.path} (${composable.name}) are one file on a case-insensitive file system`,
            `The ${target.name} target wrote two files at one path`,
            target.name,
          ),
        );
        continue;
      }
      owners.set(key, { path: output.path, component: composable.name });
      written.push(output);
    }
  }
  for (const [path, { contents, span }] of written.length ? copies : []) {
    const owner = owners.get(path.toLowerCase());
    if (owner) {
      diagnostics.push(
        createDiagnostic("UF1104", {
          file,
          span,
          message: `The shared module ${path} and ${owner.component}'s ${target.name} output, ${owner.path}, are one file: each output tree holds a copy of the module beside the components.`,
          help: "Rename the shared module, or the component.",
          target: target.name,
        }),
      );
      continue;
    }
    written.push({ path, contents });
  }
  return {
    files: written,
    owners: Object.fromEntries(
      [...owners.values()]
        .filter(({ path }) => path !== sheetPath)
        .map(({ path, component }) => [path, component]),
    ),
  };
}

/**
 * A diagnostic a target reported, for this file and target. A malformed one (no catalogued
 * code, a span outside the source) becomes UF9001: it could neither be sorted nor shown.
 */
function reported(value: unknown, source: string, file: string, target: string): Diagnostic {
  const problem = diagnosticProblem(value, source.length);
  if (problem) {
    return internal(file, problem, `The ${target} target reported a malformed diagnostic`, target);
  }
  const { code, ...init } = value as Omit<Diagnostic, "file" | "target">;
  return createDiagnostic(code, { ...init, file, target });
}

/** Why a value is not a diagnostic whose spans lie in a source of `length` characters. */
function diagnosticProblem(value: unknown, length: number): string | undefined {
  if (!isRecord(value)) return `${describe(value)} instead of a diagnostic`;
  const { code, message } = value;
  if (typeof code !== "string" || typeof message !== "string") {
    return "a diagnostic without a code or a message";
  }
  const malformed = `${code}, which is not a well-formed diagnostic: ${message}`;
  const related = value.related ?? [];
  const fixes = value.fixes ?? [];
  if (
    !SEVERITIES.has(value.severity) ||
    !(value.help === undefined || typeof value.help === "string") ||
    !isRecordList(related) ||
    !isRecordList(fixes)
  ) {
    return malformed;
  }
  const edits: Record<string, unknown>[] = [];
  for (const fix of fixes) {
    const { title, confidence, edits: written } = fix;
    if (typeof title !== "string" || !CONFIDENCES.has(confidence) || !isRecordList(written)) {
      return malformed;
    }
    edits.push(...written);
  }
  if (
    related.some((item) => typeof item.message !== "string") ||
    edits.some((edit) => typeof edit.text !== "string")
  ) {
    return malformed;
  }
  const spans = [
    value.span,
    ...related.map((item) => item.span),
    ...edits.map((edit) => edit.span),
  ];
  if (!spans.every((span) => isSpanIn(span, length))) {
    return `${code}, which points outside the source (${length} characters): ${message}`;
  }
  return undefined;
}

const SEVERITIES: ReadonlySet<unknown> = new Set(["error", "warning", "info"]);
const CONFIDENCES: ReadonlySet<unknown> = new Set(["safe", "likely"]);

function isRecordList(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.every(isRecord);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A target's or a plugin's files, copied, or why the value is not a list of output files. */
function readFiles(value: unknown): { files: OutputFile[] } | { problem: string } {
  if (!Array.isArray(value)) return { problem: `${describe(value)} instead of a list of files` };
  const files: OutputFile[] = [];
  for (const [index, item] of (value as unknown[]).entries()) {
    if (
      typeof item !== "object" ||
      item === null ||
      !("path" in item) ||
      !("contents" in item) ||
      typeof item.path !== "string" ||
      typeof item.contents !== "string"
    ) {
      return { problem: `a list whose item ${index} is not a file ({ path, contents } strings)` };
    }
    files.push({ path: item.path, contents: item.contents });
  }
  return { files };
}

/** `undefined`, `an array`, `a string`, … */
function describe(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (Array.isArray(value)) return "an array";
  const type = typeof value;
  return `${/^[aeiou]/.test(type) ? "an" : "a"} ${type}`;
}

/** The first problems with a module, by JSON Pointer: `/components/0/render/tag must …`. */
function describeProblems(problems: readonly IrValidationError[]): string {
  const first = problems.slice(0, 3).map(({ path, message }) => `${path || "/"} ${message}`);
  const more = problems.length > 3 ? ` (and ${problems.length - 3} more)` : "";
  return `${first.join("; ")}${more}`;
}

/** Freezes a plain-data value and everything in it, so a plugin cannot edit it in place. */
function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) deepFreeze(item);
  }
  return value;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function internal(file: string, error: unknown, what: string, target?: string): Diagnostic {
  return createDiagnostic("UF9001", {
    file,
    span: { start: 0, end: 0 },
    message: `${what}: ${messageOf(error)}`,
    ...(target ? { target } : {}),
  });
}

function pluginFailed(
  file: string,
  plugin: string,
  hook: string,
  what: string,
  target?: string,
): Diagnostic {
  return createDiagnostic("UF8001", {
    file,
    span: { start: 0, end: 0 },
    message: `The "${plugin}" plugin's ${hook} hook ${what}`,
    ...(target ? { target } : {}),
  });
}
