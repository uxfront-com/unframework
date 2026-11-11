// `node tests/integration/scripts/matrix-diff.ts <a> <b> [--case <id>]…`: compares two parity
// matrices cell by cell, for a change of test runner on one commit. It compares each cell's status
// and each (case, target)'s tests and scenarios, ignores how the runs ran, and exits 1 on any
// difference and on no cell to compare. A failure's message may differ between runners, so those
// are listed apart and do not fail it.
//
// `matrix-diff.ts --stable <a1> <a2> <b1> <b2> [--case <id>]…`: the same over two runs of each
// runner, for engines whose own cells change from run to run (ADR-0066). Only a cell whose status
// is the same in both runs of each runner is compared, and only its status. A cell absent from
// one run of a runner is unstable, and one stable on a runner and absent from both runs of the
// other differs.
//
// Exit 2 is a bad argument or a file that is not a matrix.
import { readFileSync } from "node:fs";

import { MATRIX_VERSION, outcomeOfCell, stringifyMatrix } from "@unframework.dev/testing/node";
import type { ParityMatrix } from "@unframework.dev/testing/node";

const USAGE =
  "Usage: matrix-diff.ts <a> <b> [--case <id>]…, or --stable <a1> <a2> <b1> <b2> [--case <id>]…";

/** The scratch paths in a message name the run that wrote them (`createHarnessRun`). */
const RUN_ID = /(\.live|\.reports\/ledger|\.reports\/diffs)\/[0-9a-z]+-\d+/g;

/** What is compared of a matrix. */
export type MatrixContents = Pick<ParityMatrix, "cases" | "scenarios" | "tests">;

/** What two matrices differ in. */
export interface MatrixDiff {
  compared: number;
  cells: string[];
  records: string[];
  messages: string[];
}

/** What two runs of each of two runners differ in. */
export interface StableDiff {
  /** The cells stable on both runners: those compared. */
  stable: number;
  /** The cells absent from at least one run, which a crash partway through a run leaves. */
  absent: number;
  differing: string[];
  unstable: string[];
}

/** Reads a matrix, without its run metadata and with its run ids normalised. */
export function readMatrix(path: string): MatrixContents {
  const matrix = JSON.parse(readFileSync(path, "utf8")) as ParityMatrix;
  if (matrix.version !== MATRIX_VERSION) {
    throw new Error(
      `${path}: parity matrix version ${String(matrix.version)}, not ${String(MATRIX_VERSION)}.`,
    );
  }
  for (const part of ["cases", "scenarios", "tests"] as const) {
    if (typeof matrix[part] !== "object" || matrix[part] === null) {
      throw new Error(`${path}: not a parity matrix: it has no ${part}.`);
    }
  }
  const { cases, scenarios, tests } = matrix;
  const contents: ParityMatrix = {
    version: MATRIX_VERSION,
    run: "",
    projects: [],
    cases,
    scenarios,
    tests,
  };
  return JSON.parse(stringifyMatrix(contents).replace(RUN_ID, "$1/<run>")) as MatrixContents;
}

/** The sorted keys of several records, L7 before L10. */
function keysOf(...records: readonly (object | undefined)[]): string[] {
  return [...new Set(records.flatMap((record) => Object.keys(record ?? {})))].toSorted(
    (one, other) => one.localeCompare(other, "en", { numeric: true }),
  );
}

/** The cases to compare. A named case no matrix holds would otherwise compare nothing and pass. */
function casesOf(matrices: readonly MatrixContents[], only: readonly string[]): string[] {
  const all = keysOf(
    ...matrices.flatMap(({ cases, scenarios, tests }) => [cases, scenarios, tests]),
  );
  for (const id of only) {
    if (!all.includes(id)) throw new Error(`No matrix holds the case ${id}.`);
  }
  return only.length ? all.filter((id) => only.includes(id)) : all;
}

/** A cell without its failure message, which is all that may differ between two runners. */
function statusOf(cell: string): string {
  return outcomeOfCell(cell).status === "fail" ? "fail" : cell;
}

/** The first line two differing messages part on: the headlines of a long diff may be equal. */
function firstDifference(a: string, b: string): string {
  const [linesA, linesB] = [a.split("\n"), b.split("\n")];
  let line = 0;
  while (linesA[line] === linesB[line]) line += 1;
  const shownLine = (text: string | undefined) => text ?? "(no such line)";
  return `line ${line + 1}:\n    a ${shownLine(linesA[line])}\n    b ${shownLine(linesB[line])}`;
}

/** Compares two matrices, on the named cases if any. */
export function diffMatrices(
  a: MatrixContents,
  b: MatrixContents,
  only: readonly string[] = [],
): MatrixDiff {
  const diff: MatrixDiff = { compared: 0, cells: [], records: [], messages: [] };
  for (const id of casesOf([a, b], only)) {
    for (const target of keysOf(a.cases[id], b.cases[id])) {
      const [layersA, layersB] = [a.cases[id]?.[target] ?? {}, b.cases[id]?.[target] ?? {}];
      for (const layer of keysOf(layersA, layersB) as (keyof typeof layersA)[]) {
        diff.compared += 1;
        const [cellA, cellB] = [layersA[layer], layersB[layer]];
        const statusA = cellA === undefined ? "absent" : statusOf(cellA);
        const statusB = cellB === undefined ? "absent" : statusOf(cellB);
        const where = `${id} › ${target} › ${layer}`;
        if (statusA !== statusB) {
          diff.cells.push(`${where}: a ${statusA}, b ${statusB}`);
        } else if (cellA !== cellB) {
          diff.messages.push(`${where}: ${firstDifference(cellA!, cellB!)}`);
        }
      }
    }
    for (const target of keysOf(a.scenarios[id], b.scenarios[id])) {
      const [one, other] = [a.scenarios[id]?.[target], b.scenarios[id]?.[target]];
      if (JSON.stringify(one) !== JSON.stringify(other)) {
        diff.records.push(`${id} › ${target} › scenarios: a ${shown(one)}, b ${shown(other)}`);
      }
    }
    for (const target of keysOf(a.tests[id], b.tests[id])) {
      const [testsA, testsB] = [a.tests[id]?.[target], b.tests[id]?.[target]];
      for (const test of keysOf(testsA, testsB)) {
        const [one, other] = [testsA?.[test], testsB?.[test]];
        if (JSON.stringify(one) !== JSON.stringify(other)) {
          diff.records.push(
            `${id} › ${target} › test ${JSON.stringify(test)}: a ${shown(one)}, b ${shown(other)}`,
          );
        }
      }
    }
  }
  return diff;
}

const shown = (value: unknown) => (value === undefined ? "absent" : JSON.stringify(value));

/** Compares two runs of each runner, on the named cases if any. */
export function diffStable(
  runs: readonly [MatrixContents, MatrixContents, MatrixContents, MatrixContents],
  only: readonly string[] = [],
): StableDiff {
  const diff: StableDiff = { stable: 0, absent: 0, differing: [], unstable: [] };
  for (const id of casesOf(runs, only)) {
    for (const target of keysOf(...runs.map((run) => run.cases[id]))) {
      const layers = runs.map((run) => run.cases[id]?.[target] ?? {});
      for (const layer of keysOf(...layers) as (keyof (typeof layers)[number])[]) {
        const statuses = layers.map((cells) => {
          const cell = cells[layer];
          return cell === undefined ? undefined : statusOf(cell);
        });
        const [a1, a2, b1, b2] = statuses;
        const where = `${id} › ${target} › ${layer}`;
        if (statuses.includes(undefined)) diff.absent += 1;
        const [a, b] = [a1 === a2 ? a1 : undefined, b1 === b2 ? b1 : undefined];
        const [goneA, goneB] = [
          a1 === undefined && a2 === undefined,
          b1 === undefined && b2 === undefined,
        ];
        if (a !== undefined && b !== undefined) {
          diff.stable += 1;
          if (a !== b) diff.differing.push(`${where}: a ${a}, b ${b}`);
        } else if (a !== undefined && goneB) {
          diff.differing.push(`${where}: a ${a}, b absent`);
        } else if (b !== undefined && goneA) {
          diff.differing.push(`${where}: a absent, b ${b}`);
        } else {
          const [w, x, y, z] = statuses.map((status) => status ?? "absent");
          diff.unstable.push(`${where}: a1 ${w}, a2 ${x}, b1 ${y}, b2 ${z}`);
        }
      }
    }
  }
  return diff;
}

/** Parses the arguments, and throws the usage on any it cannot read. */
export function parseDiffArgs(argv: readonly string[]): {
  files: string[];
  stable: boolean;
  cases: string[];
} {
  const files: string[] = [];
  const cases: string[] = [];
  let stable = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === "--stable") {
      stable = true;
    } else if (arg === "--case") {
      const id = argv[(index += 1)];
      if (id === undefined || id.startsWith("--")) throw new Error(USAGE);
      cases.push(id);
    } else if (arg.startsWith("--")) {
      throw new Error(USAGE);
    } else {
      files.push(arg);
    }
  }
  if (files.length !== (stable ? 4 : 2)) throw new Error(USAGE);
  return { files, stable, cases };
}

// `console.log`, not `process.stdout.write`: it ignores a reader that closes early (`| head`),
// which would otherwise end the run on an unhandled EPIPE, with the wrong exit status.
function list(heading: string, lines: readonly string[]): void {
  console.log(`${heading}: ${lines.length}`);
  for (const line of lines) console.log(`  ${line}`);
}

function main(argv: readonly string[]): number {
  try {
    const { files, stable, cases } = parseDiffArgs(argv);
    const matrices = files.map(readMatrix);
    if (stable) {
      const [a1, a2, b1, b2] = matrices;
      const diff = diffStable([a1!, a2!, b1!, b2!], cases);
      console.log(`stable cells: ${diff.stable}`);
      console.log(`absent cells: ${diff.absent}`);
      list("stable cells differ", diff.differing);
      list("unstable cells", diff.unstable);
      return diff.differing.length || diff.stable === 0 ? 1 : 0;
    }
    const diff = diffMatrices(matrices[0]!, matrices[1]!, cases);
    console.log(`cells compared: ${diff.compared}`);
    list("cells differ", diff.cells);
    list("tests and scenarios differ", diff.records);
    list("failure messages differ", diff.messages);
    return diff.cells.length || diff.records.length || diff.compared === 0 ? 1 : 0;
  } catch (error) {
    console.error(`[uf] ${(error as Error).message}`);
    return 2;
  }
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
