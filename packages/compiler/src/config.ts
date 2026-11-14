// `unframework.config.ts` (plan §8.1, ADR-0076). The bundler plugin doesn't read it: it takes
// explicit options.
import { existsSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { closest } from "@unframework.dev/analyzer";
import { createDiagnostic } from "@unframework.dev/diagnostics";
import type { Diagnostic, DiagnosticCode } from "@unframework.dev/diagnostics";

import type { LiveFonts, PackageConfig, TargetName, VitePluginOption } from "./config-types.ts";
import { builtinTargets, TARGET_NAMES } from "./targets.ts";

/** The configuration with its defaults applied, and its paths absolute. */
export interface ResolvedConfig {
  targets: readonly TargetName[];
  srcDir: string;
  outDir: string;
  targetOptions: Partial<Record<TargetName, unknown>>;
  typeOracle: "syntactic" | "tsgo";
  strict: boolean;
  package?: PackageConfig;
  /** The project's Vite plugins, as a function that gives a fresh set (ADR-0104). */
  vitePlugins?: () => VitePluginOption | Promise<VitePluginOption>;
  /** The ambient declaration files, absolute (ADR-0104). */
  declarations: readonly string[];
  /** Which fonts may draw text when pixels compare live (ADR-0105). */
  liveFonts: LiveFonts;
}

/** Where a configuration came from: what {@link loadConfig} gives {@link resolveConfig}. */
export interface ConfigOrigin {
  /** The directory relative paths resolve against. Defaults to the working directory. */
  directory?: string;
  /** The file as diagnostics name it. Defaults to `unframework.config.ts`. */
  file?: string;
}

/** The result of {@link loadConfig}. */
export interface LoadedConfig extends ConfigOrigin {
  /** The file's default export, `{}` when there is no file, `undefined` when it failed to load. */
  raw: unknown;
  /** The config's directory, or the root when there is no file. */
  directory: string;
  /** The file relative to the root, when there is one. */
  file?: string;
  diagnostics: Diagnostic[];
}

/** The result of {@link resolveConfig}. */
export interface ResolveConfigResult {
  /** `undefined` when any field is invalid. */
  config: ResolvedConfig | undefined;
  diagnostics: Diagnostic[];
}

/** The file names {@link loadConfig} looks for, the first one found winning. */
const CONFIG_FILES = [
  "unframework.config.ts",
  "unframework.config.mts",
  "unframework.config.js",
  "unframework.config.mjs",
];

const FIELDS = [
  "targets",
  "srcDir",
  "outDir",
  "targetOptions",
  "typeOracle",
  "strict",
  "package",
  "vitePlugins",
  "declarations",
  "liveFonts",
];
const PACKAGE_FIELDS = ["targets", "resolveFrom"];
const TYPE_ORACLES = ["syntactic", "tsgo"];
const LIVE_FONTS = ["bundled", "any"];

/** A configuration has no source span to point at: the message names the file, or the field. */
const NO_SPAN = { start: 0, end: 0 };

/**
 * Imports `unframework.config.{ts,mts,js,mjs}` from `root`, or `file` relative to it, through
 * Node's type stripping. A project without a config file takes the defaults, so that is no error.
 * It never throws: a file that cannot be imported, or has no default export, is UF7001.
 */
export async function loadConfig(root: string, file?: string): Promise<LoadedConfig> {
  const base = resolve(root);
  const path =
    file === undefined
      ? CONFIG_FILES.map((name) => resolve(base, name)).find((each) => existsSync(each))
      : resolve(base, file);
  if (path === undefined) return { raw: {}, directory: base, diagnostics: [] };

  const shown = relative(base, path);
  const failed = (reason: string): LoadedConfig => ({
    raw: undefined,
    directory: dirname(path),
    file: shown,
    diagnostics: [
      createDiagnostic("UF7001", {
        file: shown,
        span: NO_SPAN,
        message: `The configuration file ${shown} could not be loaded: ${reason}`,
      }),
    ],
  });
  try {
    const loaded = (await import(pathToFileURL(path).href)) as { default?: unknown };
    if (!("default" in loaded) || isEmptyCommonJs(loaded)) {
      return failed("it has no default export.");
    }
    return { raw: loaded.default, directory: dirname(path), file: shown, diagnostics: [] };
  } catch (error) {
    return failed(reasonOf(error));
  }
}

/**
 * Checks a configuration and applies its defaults. It never throws: a field of the wrong shape is
 * UF7002, a name that is no built-in target UF7003, and options the target's schema rejects, or a
 * target without a schema is given, UF7004, each with the field's JSON pointer. It is asynchronous
 * because a Standard Schema may be.
 */
export async function resolveConfig(
  raw: unknown,
  origin: ConfigOrigin = {},
): Promise<ResolveConfigResult> {
  const diagnostics: Diagnostic[] = [];
  const report: Report = (code, pointer, problem) => {
    diagnostics.push(
      createDiagnostic(code, {
        file: origin.file ?? "unframework.config.ts",
        span: NO_SPAN,
        message: `The configuration at ${JSON.stringify(pointer)} ${problem}`,
      }),
    );
  };
  try {
    const config = await checkConfig(raw, resolve(origin.directory ?? "."), report);
    return { config: diagnostics.length > 0 ? undefined : config, diagnostics };
  } catch (error) {
    // A getter or a proxy in the file can throw as a field is read.
    report("UF7002", "", `could not be read: ${reasonOf(error)}`);
    return { config: undefined, diagnostics };
  }
}

/** The configuration, whose result only counts when nothing was reported. */
async function checkConfig(
  raw: unknown,
  directory: string,
  report: Report,
): Promise<ResolvedConfig | undefined> {
  if (!isRecord(raw)) {
    report("UF7002", "", "must be an object, as `defineConfig` takes.");
    return undefined;
  }
  checkFields(raw, "", FIELDS, report);

  const targets =
    raw.targets === undefined ? [...TARGET_NAMES] : targetList(raw.targets, "/targets", report);
  const srcDir = pathField(
    raw.srcDir === undefined ? "src" : raw.srcDir,
    "/srcDir",
    directory,
    report,
  );
  const outDir = pathField(
    raw.outDir === undefined ? "dist" : raw.outDir,
    "/outDir",
    directory,
    report,
  );
  const targetOptions = await resolveTargetOptions(raw.targetOptions, report);
  if (raw.typeOracle !== undefined && !TYPE_ORACLES.includes(raw.typeOracle as string)) {
    report("UF7002", "/typeOracle", `must be "syntactic" or "tsgo".`);
  }
  if (raw.strict !== undefined && typeof raw.strict !== "boolean") {
    report("UF7002", "/strict", "must be a boolean.");
  }
  const packaging =
    raw.package === undefined ? undefined : resolvePackage(raw.package, targets, directory, report);
  // A list of plugins would be one set that every server shares (ADR-0104).
  if (raw.vitePlugins !== undefined && typeof raw.vitePlugins !== "function") {
    report(
      "UF7002",
      "/vitePlugins",
      "must be a function that returns the Vite plugins, such as `() => [engine()]`: each Vite server calls it for a fresh set.",
    );
  }
  const declarations = declarationList(raw.declarations, directory, report);
  if (raw.liveFonts !== undefined && !LIVE_FONTS.includes(raw.liveFonts as string)) {
    report("UF7002", "/liveFonts", `must be "bundled" or "any".`);
  }

  return {
    targets: targets!,
    srcDir: srcDir!,
    outDir: outDir!,
    targetOptions,
    typeOracle: (raw.typeOracle as ResolvedConfig["typeOracle"] | undefined) ?? "syntactic",
    strict: (raw.strict as boolean | undefined) ?? false,
    ...(packaging ? { package: packaging } : {}),
    ...(raw.vitePlugins === undefined
      ? {}
      : { vitePlugins: raw.vitePlugins as NonNullable<ResolvedConfig["vitePlugins"]> }),
    declarations,
    liveFonts: (raw.liveFonts as LiveFonts | undefined) ?? "bundled",
  };
}

/** The declaration files, absolute. A file need not exist yet: an engine may generate it. */
function declarationList(value: unknown, directory: string, report: Report): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    report("UF7002", "/declarations", "must be a list of paths to declaration files.");
    return [];
  }
  const paths: string[] = [];
  for (const [index, item] of (value as unknown[]).entries()) {
    const path = pathField(item, `/declarations/${index}`, directory, report);
    if (path) paths.push(path);
  }
  return paths;
}

/** Reports a problem with the field at a JSON pointer; `problem` finishes the sentence. */
type Report = (code: DiagnosticCode, pointer: string, problem: string) => void;

/**
 * Node gives a CommonJS file a `default`, its `module.exports`, even when it exports nothing, and a
 * `.ts` or `.js` file with no ES module syntax left once its types are stripped loads as CommonJS
 * unless its package sets `"type": "module"`. An explicit `module.exports = {}` reads the same, so
 * it counts too.
 */
function isEmptyCommonJs(loaded: { default?: unknown }): boolean {
  return (
    "module.exports" in loaded &&
    isRecord(loaded.default) &&
    Object.keys(loaded.default).length === 0
  );
}

/** What a thrown value says. Whatever the value is, reading it here can't throw again. */
function reasonOf(error: unknown): string {
  try {
    if (!(error instanceof Error)) return String(error);
    // Node's own messages may end their sentence, or a line, or neither.
    const text = String(error.message).trimEnd() || "it threw an error with no message";
    const reason = text.replace(/\.?$/, ".");
    if (!("code" in error) || error.code !== "ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX") return reason;
    return `${reason} Node loads a TypeScript configuration by stripping its types, so the file cannot use syntax that needs compiling, such as an enum or a parameter property.`;
  } catch {
    return "it threw a value that can't be read.";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** One key as a JSON pointer's segment (RFC 6901). */
function segment(key: string): string {
  return `/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`;
}

function didYouMean(name: string, names: readonly string[]): string {
  const meant = closest(name, names);
  return meant ? ` Did you mean \`${meant}\`?` : "";
}

/** A misspelt field would otherwise be ignored in silence (P2). */
function checkFields(
  record: Record<string, unknown>,
  pointer: string,
  fields: readonly string[],
  report: Report,
): void {
  for (const key of Object.keys(record)) {
    if (fields.includes(key)) continue;
    report(
      "UF7002",
      `${pointer}${segment(key)}`,
      `is not a field of the configuration.${didYouMean(key, fields)}`,
    );
  }
}

/** Own names only: `toString` is not a target. */
function isTargetName(name: string): name is TargetName {
  return Object.hasOwn(builtinTargets, name);
}

function reportUnknownTarget(name: string, pointer: string, report: Report): void {
  const meant = didYouMean(name, TARGET_NAMES);
  report(
    "UF7003",
    pointer,
    `names the unknown target ${JSON.stringify(name)}.${meant || ` The built-in targets are ${TARGET_NAMES.join(", ")}.`}`,
  );
}

/** A list of targets: `compile()` throws on a repeated one, so it is reported here first. */
function targetList(
  value: unknown,
  pointer: string,
  report: Report,
  within?: readonly TargetName[],
): TargetName[] | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    report("UF7002", pointer, "must be a list of at least one target name.");
    return undefined;
  }
  const seen: TargetName[] = [];
  for (const [index, item] of (value as unknown[]).entries()) {
    const at = `${pointer}/${index}`;
    if (typeof item !== "string") report("UF7002", at, "must be a target name.");
    else if (!isTargetName(item)) reportUnknownTarget(item, at, report);
    else if (seen.includes(item)) report("UF7002", at, `repeats the target "${item}".`);
    else if (within && !within.includes(item)) {
      report("UF7002", at, `names the target "${item}", which "/targets" leaves out.`);
    } else seen.push(item);
  }
  return seen;
}

function pathField(
  value: unknown,
  pointer: string,
  directory: string,
  report: Report,
): string | undefined {
  if (typeof value !== "string" || !value) {
    report("UF7002", pointer, "must be a path, as a string that is not empty.");
    return undefined;
  }
  return resolve(directory, value);
}

async function resolveTargetOptions(
  value: unknown,
  report: Report,
): Promise<Partial<Record<TargetName, unknown>>> {
  const resolved: Partial<Record<TargetName, unknown>> = {};
  if (value === undefined) return resolved;
  if (!isRecord(value)) {
    report("UF7002", "/targetOptions", "must be an object, by target name.");
    return resolved;
  }
  for (const [name, options] of Object.entries(value)) {
    const pointer = `/targetOptions${segment(name)}`;
    if (!isTargetName(name)) {
      reportUnknownTarget(name, pointer, report);
      continue;
    }
    if (options === undefined) continue;
    const schema = builtinTargets[name].options;
    if (!schema) {
      // Nothing would read them, so they would be ignored in silence (P2, ADR-0076).
      const problem = `is not valid: \`${name}\` declares no options.`;
      if (!isRecord(options)) report("UF7004", pointer, problem);
      else {
        for (const key of Reflect.ownKeys(options)) {
          report("UF7004", `${pointer}${segment(String(key))}`, problem);
        }
      }
      continue;
    }
    try {
      const result = await schema["~standard"].validate(options);
      if (!result.issues) {
        resolved[name] = result.value;
        continue;
      }
      for (const issue of result.issues) {
        const path = (issue.path ?? [])
          .map((part) => segment(String(typeof part === "object" ? part.key : part)))
          .join("");
        report("UF7004", `${pointer}${path}`, `is not valid: ${issue.message}`);
      }
    } catch (error) {
      report(
        "UF7004",
        pointer,
        `could not be validated: the target's schema threw: ${reasonOf(error)}`,
      );
    }
  }
  return resolved;
}

function resolvePackage(
  value: unknown,
  targets: readonly TargetName[] | undefined,
  directory: string,
  report: Report,
): PackageConfig | undefined {
  if (!isRecord(value)) {
    report("UF7002", "/package", "must be an object.");
    return undefined;
  }
  checkFields(value, "/package", PACKAGE_FIELDS, report);
  const resolved: PackageConfig = {};
  if (value.targets !== undefined) {
    const list = targetList(value.targets, "/package/targets", report, targets);
    if (list) resolved.targets = list;
  }
  const from = value.resolveFrom;
  if (typeof from === "string") {
    const path = pathField(from, "/package/resolveFrom", directory, report);
    if (path) resolved.resolveFrom = path;
  } else if (isRecord(from)) {
    const each: Partial<Record<TargetName, string>> = {};
    for (const [name, path] of Object.entries(from)) {
      const pointer = `/package/resolveFrom${segment(name)}`;
      if (!isTargetName(name)) {
        reportUnknownTarget(name, pointer, report);
        continue;
      }
      if (path === undefined) continue;
      const absolute = pathField(path, pointer, directory, report);
      if (absolute) each[name] = absolute;
    }
    resolved.resolveFrom = each;
  } else if (from !== undefined) {
    report(
      "UF7002",
      "/package/resolveFrom",
      "must be a path, or an object of paths by target name.",
    );
  }
  return resolved;
}
