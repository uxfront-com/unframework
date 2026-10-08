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

/** What a directive says a misuse breaks: a prop, an event, a model or a slot. */
export type ConsumerKind = "prop" | "event" | "model" | "slot";

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
 * The kinds a target's checker cannot check, with the reason (ADR-0059's feasibility table). A
 * directive of such a kind fails: a gap is declared, never filled with a weaker check.
 */
export const CONSUMER_GAPS: Readonly<Record<string, Partial<Record<ConsumerKind, string>>>> = {
  astro: { event: "Astro has no events: its `interactivity` cell is unsupported" },
};

const DIRECTIVE =
  /@uf-expect\s+((?:TS|NG)\d+)\s+([A-Z][A-Za-z0-9]*)\.(prop|event|model|slot):([A-Za-z][A-Za-z0-9]*)(?=\s|-->|$)/;

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
    const match = DIRECTIVE.exec(text);
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
 * case's IR that the target can check.
 */
export function consumerProblems(
  target: string,
  info: CaseInfo,
  fixtures: readonly Fixture[],
  results: ReadonlyMap<string, readonly ToolchainMessage[]>,
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
        `${shown}:${line}: a directive reads \`@uf-expect <code> <Component>.<prop|event|model|slot>:<name>\`.`,
    );
    for (const { line, code, declaration, kind } of expectations) {
      const gap = CONSUMER_GAPS[target]?.[kind];
      const source = declarations.get(declaration);
      if (gap) {
        problems.push(`${shown}:${line}: ${target} cannot check a component's ${kind}s (${gap}).`);
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
 * `FileRow.uf.tsx:9`. Models and slots join when the IR has them (ADR-0055).
 */
function caseDeclarations(info: CaseInfo): Map<string, string> {
  const directory = join(info.dir, "__output__");
  const declarations = new Map<string, string>();
  const snapshots = existsSync(directory)
    ? readdirSync(directory).filter((entry) => /^ir(?:\.[^.]+)?\.json$/.test(entry))
    : [];
  for (const snapshot of snapshots.toSorted()) {
    const module = JSON.parse(readFileSync(join(directory, snapshot), "utf8")) as UfModule;
    const file = basename(module.file);
    const source = readFileSync(join(info.dir, file), "utf8");
    const at = (offset: number) => `${file}:${source.slice(0, offset).split("\n").length}`;
    for (const component of module.components) {
      for (const prop of component.props) {
        declarations.set(`${component.name}.prop:${prop.name}`, at(prop.span.start));
      }
      for (const event of component.emits?.events ?? []) {
        declarations.set(`${component.name}.event:${event.name}`, at(event.span.start));
      }
    }
  }
  return declarations;
}

function directories(path: string): string[] {
  return readdirSync(path)
    .filter((entry) => statSync(join(path, entry)).isDirectory())
    .toSorted();
}

function posix(path: string): string {
  return path.split(sep).join("/");
}
