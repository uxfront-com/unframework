import { analyze, componentImports } from "@unframework/analyzer";
import { formatOutput } from "@unframework/codegen";
import type { OutputFile, Target } from "@unframework/codegen";
import { createDiagnostic, sortDiagnostics } from "@unframework/diagnostics";
import type { Diagnostic } from "@unframework/diagnostics";
import { checkInvariants, validateModule } from "@unframework/ir";
import type { IrValidationError, ModuleApi, UfComponent, UfModule } from "@unframework/ir";
import { parseModule } from "@unframework/parser";

import { checkCapabilities } from "./capabilities.ts";
import { isSpanIn, pluginIrProblems } from "./plugin-ir.ts";
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
   * a resolver that throws is UF9001 as well.
   */
  resolve?: Resolver;
}

/** The result of {@link compile}. */
export interface CompileResult {
  filename: string;
  /** The module's IR (frozen), or `undefined` when module-level errors stop compilation. */
  ir: UfModule | undefined;
  /** Every diagnostic, sorted. Portability diagnostics carry their target. */
  diagnostics: Diagnostic[];
  /** Each target's files, by target name, in the order of `targets`. */
  outputs: Record<string, OutputFile[]>;
  /**
   * The component each output file is written for, by target name, then by the file's path:
   * the unplugin loads a file's components under ids of their own (ADR-0053).
   */
  owners: Record<string, Record<string, string>>;
}

/**
 * Compiles one `.uf.tsx` source to every selected target. A pure function of the source and
 * the options: the same input and versions give byte-identical output (P8). It throws only
 * for invalid options (an unknown target name, two targets with one name); every other
 * problem, a misbehaving plugin or target included, is a diagnostic, and an error in one
 * component or target never stops the others.
 */
export async function compile(source: string, options: CompileOptions): Promise<CompileResult> {
  const file = options.filename;
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
  try {
    const parsed = parseModule(file, source);
    const imports = new Map<string, ModuleApi | undefined>();
    for (const specifier of options.resolve ? componentImports(parsed) : []) {
      try {
        imports.set(specifier, await options.resolve!({ specifier, importer: file }));
      } catch (error) {
        imports.set(specifier, undefined);
        diagnostics.push(internal(file, error, `The resolver failed on "${specifier}"`));
      }
    }
    const analysis = analyze(parsed, { imports });
    diagnostics.push(...analysis.diagnostics);
    // The analyser keeps the IR's invariants by construction; a module that breaks one is a
    // compiler bug, and no target may emit from it.
    const broken = analysis.module && checkInvariants(analysis.module);
    if (broken?.length) {
      diagnostics.push(internal(file, describeProblems(broken), "The analyser lowered invalid IR"));
    } else {
      analysed = analysis.module && deepFreeze(analysis.module);
    }
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

  if (module) {
    for (const target of targets) {
      try {
        const emitted = await emitTarget(target, module, source, options, diagnostics);
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
  };
}

/**
 * Checks a target's capabilities, then emits, transforms and formats each component's files.
 * The files of two components, or two files of one, may not share a path, compared without
 * case: case-insensitive file systems would write one over the other.
 */
async function emitTarget(
  target: Target,
  module: UfModule,
  source: string,
  options: CompileOptions,
  diagnostics: Diagnostic[],
): Promise<{ files: OutputFile[]; owners: Record<string, string> }> {
  const file = options.filename;
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
  return {
    files: written,
    owners: Object.fromEntries(
      [...owners.values()].map(({ path, component }) => [path, component]),
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
