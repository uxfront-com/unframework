// The corpus (tests/integration/cases) as the analyser reads it: each diagnostics case triggers
// exactly the code it is named after, and every other case compiles without an error, with the
// warnings its golden diagnostics hold. The harness's L1 checks the same through the compiler;
// this keeps the analyser's own suite from accepting a rule that misfires on a valid source.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";

import { catalogue } from "@unframework/diagnostics";
import type { ModuleApi } from "@unframework/ir";
import { parseModule } from "@unframework/parser";
import type { ParsedModule } from "@unframework/parser";
import { createSyntacticOracle } from "@unframework/type-oracle";
import type { TypeOracle, TypeShape } from "@unframework/type-oracle";
import { describe, expect, it } from "vitest";

import {
  analyze,
  componentImports,
  frameworkOf,
  isAuthoringModule,
  isSharedModuleSpecifier,
  moduleSpecifiers,
  shapeQueries,
  sharedModuleImports,
  stylesheetImports,
} from "../src/index.ts";
import type { SharedModule, Shapes, StylesheetSource } from "../src/index.ts";

const CASES = new URL("../../../tests/integration/cases/", import.meta.url).pathname;

/** The case sources under a directory, relative to the cases' root, sorted. */
function sources(directory: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(directory)) {
    if (name.startsWith("__") || name.startsWith(".")) continue;
    const path = join(directory, name);
    if (statSync(path).isDirectory()) found.push(...sources(path));
    else if (name.endsWith(".uf.tsx")) found.push(relative(CASES, path));
  }
  return found.toSorted();
}

/** The diagnostics cases whose name is not their code's catalogue name, with that code. */
const NAMED_OTHERWISE: Readonly<Record<string, string>> = {
  "arrow-component": "UF1102",
  "framework-import-rejected": "UF1201",
  "non-canonical-event": "UF3004",
  "nullable-bound-value": "UF1002",
};

/**
 * The diagnostics cases whose code `compile()` reports after the analyser, which finds nothing:
 * the codegen scoper's (ADR-0063).
 */
const AFTER_ANALYSIS: ReadonlySet<string> = new Set(["unscopable-selector"]);

/** The warnings the corpus's feature cases hold on purpose. */
const WARNINGS: Readonly<Record<string, readonly string[]>> = {
  "jsx/escaping/TemplateTip.uf.tsx": ["UF3011"],
  "semantics/setup-once/WelcomeBanner.uf.tsx": ["UF2007"],
};

const codesByName = new Map([...catalogue.values()].map((entry) => [entry.name, entry.code]));

/**
 * The file-backed type oracle a case's sources are read through, as the harness's (ADR-0067): it
 * reads the case's own files, its second `.uf.tsx` and its `.ts` type modules among them, and the
 * packages they import, so each case stays self-contained.
 */
function caseOracle(directory: string): TypeOracle {
  const root = CASES.replace(/\/+$/, "");
  const dir = join(CASES, directory);
  return createSyntacticOracle({
    root,
    readFile: async (path) => {
      const file = join(path);
      if (relative(dir, dirname(file)) !== "" && !file.split(sep).includes("node_modules")) {
        return undefined;
      }
      return readFile(file, "utf8").catch(() => undefined);
    },
  });
}

/** The shapes of the types a module names, as `compile()` asks its oracle for them. */
async function shapesOf(parsed: ParsedModule, oracle: TypeOracle): Promise<Shapes> {
  const shapes = new Map<string, TypeShape>();
  for (const query of shapeQueries(parsed)) {
    shapes.set(`${query.span.start}:${query.span.end}`, await oracle.resolveShape(query));
  }
  return (span) => shapes.get(`${span.start}:${span.end}`);
}

/** A file of a case, or `undefined` where there is none. */
function caseFile(file: string): string | undefined {
  try {
    return readFileSync(join(CASES, file), "utf8");
  } catch {
    return undefined;
  }
}

/** A shared module's file, as the resolver names it: with `.ts` where its specifier has none. */
function fileOf(from: string, written: string): string | undefined {
  return isSharedModuleSpecifier(written)
    ? join(from, written.endsWith(".ts") ? written : `${written}.ts`)
    : undefined;
}

/**
 * A shared `.ts` module a case source imports, as the compiler's file resolver reads it
 * (ADR-0070): the first framework import and the first unreadable relative import of the modules
 * it reaches, each named relative to the importer's directory.
 */
function sharedModule(directory: string, specifier: string): SharedModule | undefined {
  const first = fileOf(directory, specifier);
  if (first === undefined || caseFile(first) === undefined) return undefined;
  const local = (file: string) => relative(directory, file).split(sep).join("/");
  const module: SharedModule = { file: local(first) };
  const files = [first];
  for (let index = 0; index < files.length; index++) {
    const file = files[index]!;
    for (const imported of moduleSpecifiers(parseModule(file, caseFile(file)!))) {
      if (frameworkOf(imported) || isAuthoringModule(imported)) {
        module.framework ??= { specifier: imported, file: local(file) };
      } else if (imported.startsWith("./") || imported.startsWith("../")) {
        const next = fileOf(dirname(file), imported);
        if (next === undefined || caseFile(next) === undefined) {
          module.unresolved ??= { specifier: imported, file: local(file) };
        } else if (!files.includes(next)) {
          files.push(next);
        }
      }
    }
  }
  return module;
}

/**
 * A case source analysed as `compile()` analyses it: with the shapes of its types and the APIs
 * of the files it imports in its case, each read through the case's oracle, as the compiler's
 * file resolver gives them (ADR-0053, ADR-0067), the shared `.ts` modules it imports (ADR-0070),
 * and the stylesheets beside it (ADR-0063), whose use of `:slotted()` only the codegen scoper
 * reads: no case here needs it.
 */
async function analyzeCase(file: string) {
  const parsed = parseModule(file, readFileSync(join(CASES, file), "utf8"));
  const directory = file.slice(0, file.lastIndexOf("/"));
  const oracle = caseOracle(directory);
  const imports = new Map<string, ModuleApi | undefined>();
  for (const specifier of componentImports(parsed)) {
    const child = join(directory, specifier);
    let source: string;
    try {
      source = readFileSync(join(CASES, child), "utf8");
    } catch {
      imports.set(specifier, undefined);
      continue;
    }
    const childParsed = parseModule(child, source);
    const api = analyze(childParsed, { shapes: await shapesOf(childParsed, oracle) }).api;
    imports.set(specifier, api && { ...api, file: specifier.slice(2) });
  }
  const stylesheets = new Map<string, StylesheetSource | undefined>();
  for (const specifier of stylesheetImports(parsed)) {
    const sheet = join(directory, specifier);
    try {
      const source = readFileSync(join(CASES, sheet), "utf8");
      stylesheets.set(specifier, { file: sheet, source, slotted: false });
    } catch {
      stylesheets.set(specifier, undefined);
    }
  }
  const modules = new Map(
    sharedModuleImports(parsed).map((specifier) => [specifier, sharedModule(directory, specifier)]),
  );
  const shapes = await shapesOf(parsed, oracle);
  await oracle.dispose();
  return analyze(parsed, { imports, modules, stylesheets, shapes });
}

describe("the corpus", () => {
  const all = sources(CASES);

  // A case of several sources triggers its code in one of them, as the harness joins them
  // (ADR-0057): a child the source imports may be valid.
  const diagnosticsCases = [
    ...new Set(
      all
        .filter((file) => file.startsWith("diagnostics/"))
        .map((file) => file.slice(0, file.lastIndexOf("/"))),
    ),
  ];
  it.each(diagnosticsCases)("%s triggers exactly its code", async (id) => {
    const name = id.split("/")[1]!;
    const code = NAMED_OTHERWISE[name] ?? codesByName.get(name);
    expect(code, `no code is named ${name}`).toBeDefined();
    const files = all.filter((file) => file.startsWith(`${id}/`));
    const diagnostics = (await Promise.all(files.map(analyzeCase))).flatMap(
      (result) => result.diagnostics,
    );
    if (AFTER_ANALYSIS.has(name)) {
      expect(diagnostics).toEqual([]);
      return;
    }
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(new Set(diagnostics.map((diagnostic) => diagnostic.code))).toEqual(new Set([code]));
  });

  it.each(all.filter((file) => !file.startsWith("diagnostics/")))(
    "%s compiles with no error, and only its own warnings",
    async (file) => {
      const { module, diagnostics } = await analyzeCase(file);
      expect(module).toBeDefined();
      expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual(WARNINGS[file] ?? []);
    },
  );
});
