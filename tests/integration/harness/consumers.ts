// L4's consumer check (ADR-0059, plan §7.2): hand-written consumers of a case's outputs, in each
// target's own language, under `tests/toolchains/<target>/consumers/<area>/<case>/`. Each misuse
// carries a `@uf-expect <code> <Component>.<kind>:<name>` comment on the line before it, and the
// judging is inverted: the checker's diagnostics on a fixture must equal its directives. A missing
// expected error fails, as does any other diagnostic, so a correct consumer must check clean.
// Source maps are M6's (L14): until then a failure names the declaration's `.uf.tsx` line from
// the case's IR.
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, sep } from "node:path";

import type { ToolchainMessage } from "@unframework/codegen";
import type { UfModule } from "@unframework/ir";

import type { CaseInfo } from "./cases.ts";
import { CASES_DIR, REPO_ROOT, toolchainDir } from "./paths.ts";

/**
 * What a directive says a misuse breaks: a prop, an event, a model, a slot, or a type the
 * component's module exports (ADR-0068).
 */
export type ConsumerKind = "prop" | "event" | "model" | "slot" | "type";

/** One `@uf-expect` directive. */
export interface Expectation {
  /** The misuse's line (1-based): the line after the directive. */
  line: number;
  /** The checker's code, `TS2322` or an `NG` code. */
  code: string;
  /** The declaration the misuse breaks, `FileRow.prop:path`. */
  declaration: string;
  kind: ConsumerKind;
}

/** A fixture, and the file the checker read for it: itself, or its copy under a canary. */
export interface Fixture {
  path: string;
  checked: string;
}

/**
 * What a target's checker cannot check: a kind of declaration, or a finer part of one
 * (ADR-0059's feasibility table): a slot without props (`named-slot`), or a slot whose props
 * name a type parameter of its component (`generic-slot-props`, ADR-0068), so a gap in one part
 * leaves the target's other slots checked. Models' setters join with models: a model's directive
 * names its value, so a gap in its setter alone (`model-setter`) fails no directive, and is
 * declared for the record.
 */
export type ConsumerGap = ConsumerKind | "named-slot" | "generic-slot-props" | "model-setter";

/**
 * The declarations a target's checker cannot check, with the reason (ADR-0059's feasibility
 * table). A directive that names one fails: a gap is declared, never filled with a weaker check.
 */
export const CONSUMER_GAPS: Readonly<Record<string, Partial<Record<ConsumerGap, string>>>> = {
  astro: {
    event: "Astro has no events: its `interactivity` cell is unsupported",
    "named-slot": "Astro does not type a named slot without props, which renders through `<slot>`",
  },
  solid: {
    "model-setter":
      "Solid's setter of a signal (`onValueChange={setCount}`) is assignable to any model's change callback: only the model's value is checked",
  },
};

/** A whole directive line: nothing may follow it but the end of an HTML comment. */
const DIRECTIVE =
  /@uf-expect\s+((?:TS|NG)\d+)\s+([A-Z][A-Za-z0-9]*)\.(prop|event|model|slot|type):([A-Za-z][A-Za-z0-9]*)\s*(?:-->)?\s*$/;

/** A target's consumer fixtures: `tests/toolchains/<target>/consumers`. */
export function consumersDir(target: string): string {
  return join(toolchainDir(target), "consumers");
}

/** The cases a target has consumer fixtures for, as `area/name`, sorted. */
export function consumerCases(target: string): string[] {
  const root = consumersDir(target);
  if (!existsSync(root)) return [];
  return directories(root).flatMap((area) =>
    directories(join(root, area)).map((name) => `${area}/${name}`),
  );
}

/** A case's consumer fixtures for a target (absolute paths, sorted): none without a tree. */
export function consumerFixtures(target: string, caseId: string): string[] {
  const directory = join(consumersDir(target), ...caseId.split("/"));
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .toSorted()
    .map((entry) => join(directory, entry))
    .filter((path) => statSync(path).isFile());
}

/**
 * Copies a case's fixtures under a canary's tree, `<root>/consumers/<case>/`, importing the
 * canary's fresh compile, `<root>/cases/<case>/__output__/`, instead of the golden outputs: the
 * relative path to the cases directory is the one thing a copy changes, so its lines stay put.
 */
export function copyFixtures(fixtures: readonly string[], root: string, caseId: string): Fixture[] {
  return fixtures.map((path) => {
    const checked = join(root, "consumers", ...caseId.split("/"), basename(path));
    const from = posix(relative(dirname(path), CASES_DIR));
    const to = posix(relative(dirname(checked), join(root, "cases")));
    mkdirSync(dirname(checked), { recursive: true });
    writeFileSync(checked, readFileSync(path, "utf8").replaceAll(`"${from}/`, `"${to}/`));
    return { path, checked };
  });
}

/** A fixture's directives, and the lines of every `@uf-expect` that does not read as one. */
export function readExpectations(contents: string): {
  expectations: Expectation[];
  malformed: number[];
} {
  const expectations: Expectation[] = [];
  const malformed: number[] = [];
  contents.split(/\r?\n/).forEach((text, index) => {
    if (!text.includes("@uf-expect")) return;
    // One directive a line: a second would claim the same misuse line.
    const match = text.split("@uf-expect").length === 2 ? DIRECTIVE.exec(text) : null;
    if (!match) {
      malformed.push(index + 1);
      return;
    }
    const [, code, component, kind, name] = match;
    expectations.push({
      line: index + 2,
      code: code!,
      declaration: `${component!}.${kind!}:${name!}`,
      kind: kind as ConsumerKind,
    });
  });
  return { expectations, malformed };
}

/**
 * The consumer check of a case on a target: every directive met by a diagnostic with its code on
 * its line, every diagnostic met by a directive, and every directive naming a declaration of the
 * case's IR that the target can check (`gaps`, {@link CONSUMER_GAPS} by default).
 */
export function consumerProblems(
  target: string,
  info: Pick<CaseInfo, "id" | "dir">,
  fixtures: readonly Fixture[],
  results: ReadonlyMap<string, readonly ToolchainMessage[]>,
  gaps: Readonly<Record<string, Partial<Record<ConsumerGap, string>>>> = CONSUMER_GAPS,
): string[] {
  if (!fixtures.length) return [];
  const declarations = caseDeclarations(info);
  return fixtures.flatMap(({ path, checked }) => {
    const shown = posix(relative(REPO_ROOT, path));
    const messages = results.get(checked);
    if (!messages) return [`${shown}: the checker reported nothing for this file.`];
    const { expectations, malformed } = readExpectations(readFileSync(path, "utf8"));
    const problems = malformed.map(
      (line) =>
        `${shown}:${line}: a directive reads \`@uf-expect <code> <Component>.<prop|event|model|slot|type>:<name>\`.`,
    );
    for (const { line, code, declaration, kind } of expectations) {
      const found = declarations.get(declaration);
      const source = found?.at;
      const own = gaps[target] ?? {};
      const part = found?.part;
      const gap = own[kind] ?? (part === undefined ? undefined : own[part]);
      if (gap) {
        const what = own[kind] ? kind : part!;
        problems.push(
          `${shown}:${line}: ${target} cannot check a component's ${what.endsWith("s") ? what : `${what}s`} (${gap}).`,
        );
      } else if (!source) {
        problems.push(`${shown}:${line}: ${declaration} is not declared in ${info.id}'s IR.`);
      } else if (!messages.some((message) => message.code === code && message.line === line)) {
        problems.push(
          `${shown}:${line}: expected ${code} for ${declaration} (${source}), got none`,
        );
      }
    }
    for (const message of messages) {
      if (expectations.some(({ code, line }) => message.code === code && message.line === line)) {
        continue;
      }
      const at = message.line === undefined ? "" : `:${message.line}`;
      problems.push(`${shown}${at}: unexpected ${message.code ?? "diagnostic"} ${message.message}`);
    }
    return problems;
  });
}

/**
 * Every declaration a directive can name in a case's IR (`ir.json`, and `ir.<Stem>.json` for a
 * case of several sources, ADR-0057), with its `.uf.tsx` line: `FileRow.prop:path` →
 * `FileRow.uf.tsx:9`, and the finer part a gap may name (a slot without props, or one that
 * passes a type parameter). Models join when the IR has them (ADR-0055). So do the types each
 * component's module exports (ADR-0068), at their declaration: a re-exported one in the case's
 * module it comes from, `types.ts:2`.
 */
function caseDeclarations(
  info: Pick<CaseInfo, "dir">,
): Map<string, { at: string; part?: Exclude<ConsumerGap, ConsumerKind> }> {
  const directory = join(info.dir, "__output__");
  const declarations = new Map<string, { at: string; part?: Exclude<ConsumerGap, ConsumerKind> }>();
  const snapshots = existsSync(directory)
    ? readdirSync(directory).filter((entry) => /^ir(?:\.[^.]+)?\.json$/.test(entry))
    : [];
  for (const snapshot of snapshots.toSorted()) {
    const module = JSON.parse(readFileSync(join(directory, snapshot), "utf8")) as UfModule;
    const file = basename(module.file);
    const source = readFileSync(join(info.dir, file), "utf8");
    const at = (offset: number) => `${file}:${source.slice(0, offset).split("\n").length}`;
    const exported = exportedTypes(info, module, at);
    for (const component of module.components) {
      for (const [name, where] of exported) {
        declarations.set(`${component.name}.type:${name}`, { at: where });
      }
      for (const prop of component.props) {
        declarations.set(`${component.name}.prop:${prop.name}`, { at: at(prop.span.start) });
      }
      for (const event of component.emits?.events ?? []) {
        declarations.set(`${component.name}.event:${event.name}`, { at: at(event.span.start) });
      }
      for (const item of component.setup) {
        if (item.kind !== "Model") continue;
        declarations.set(`${component.name}.model:${item.name}`, { at: at(item.span.start) });
      }
      const typeParameters = new Set(component.typeParameters?.map(({ name }) => name));
      for (const slot of component.slots?.slots ?? []) {
        const generic = slot.references?.some((name) => typeParameters.has(name));
        declarations.set(`${component.name}.slot:${slot.name}`, {
          at: at(slot.span.start),
          ...(!slot.props
            ? { part: "named-slot" as const }
            : generic
              ? { part: "generic-slot-props" as const }
              : {}),
        });
      }
    }
  }
  return declarations;
}

/**
 * The types a module exports, by the name each output exports them under (ADR-0068), with where
 * each is declared: a declaration's line in the module, or for a re-export the line of its
 * declaration in the case's module it names (`./types` is `types.ts`), or else the re-export's.
 */
function exportedTypes(
  info: Pick<CaseInfo, "dir">,
  module: UfModule,
  at: (offset: number) => string,
): Map<string, string> {
  const types = new Map<string, string>();
  for (const declaration of module.types) {
    if (declaration.exported) types.set(declaration.name, at(declaration.span.start));
  }
  for (const typeExport of module.typeExports ?? []) {
    if (typeExport.kind === "Declaration") {
      types.set(typeExport.name, at(typeExport.span.start));
      continue;
    }
    const from = [typeExport.specifier, `${typeExport.specifier}.ts`]
      .map((specifier) => join(info.dir, specifier))
      .find((path) => existsSync(path) && statSync(path).isFile());
    const text = from === undefined ? undefined : readFileSync(from, "utf8");
    for (const name of typeExport.names) {
      const line = text
        ?.split("\n")
        .findIndex((each) =>
          new RegExp(`^(?:export\\s+)?(?:interface|type)\\s+${name.imported}\\b`).test(each),
        );
      types.set(
        name.exported,
        from !== undefined && line !== undefined && line !== -1
          ? `${basename(from)}:${line + 1}`
          : at(name.span.start),
      );
    }
  }
  return types;
}

function directories(path: string): string[] {
  return readdirSync(path)
    .filter((entry) => statSync(join(path, entry)).isDirectory())
    .toSorted();
}

function posix(path: string): string {
  return path.split(sep).join("/");
}
