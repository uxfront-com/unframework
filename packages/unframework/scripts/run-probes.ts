/**
 * The JSX-types probe suite: tests that pin what `unframework`'s types catch and what they
 * deliberately do not (plan §5.6 layer 1, ADR-0017).
 *
 *   pnpm --filter unframework probes [--tsc=<path to a tsc executable>]
 *
 * The package's tests run it too (test/probes.test.ts). A probe tree holds a `tsconfig.json` with the
 * authoring settings and three folders: `fixtures/` (components the probes use), `caught/` (mistakes
 * the types catch, one `@ts-expect-error` each) and `allowed/` (legitimate code and documented blind
 * spots, which must type-check clean).
 *
 * 1. The layout: every directive in `caught/` names the code it expects
 *    (`// @ts-expect-error TS2322 why`, or `{/* @ts-expect-error TS2322 why *\/}` among JSX children),
 *    every file there pins at least one, and nothing else holds a directive or a `@ts-ignore`.
 * 2. The gate: `tsc -p <tree>` must exit 0. An unused directive is TS2578, so a mistake that stops
 *    being caught fails here, and so does any false error in `allowed/` or `fixtures/`.
 * 3. The pin: a copy of the tree is checked with every directive disabled. The line after each
 *    directive must report exactly one error, with the code it names, and no other line may report
 *    anything. A directive hides every error on its line from the gate, so only the pin sees a
 *    re-vendor that errors for a different reason, or for another reason as well.
 */
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** This package's probe tree. */
export const PROBES_DIRECTORY: string = fileURLToPath(new URL("../probes", import.meta.url));

/** The folders of a probe tree, in the order the report lists them. */
const FOLDERS = ["fixtures", "caught", "allowed"] as const;

/** A directive as TypeScript reads it: the comment starts with it (there is no word boundary). */
const DIRECTIVE = /^(?:\/\/\/?|\{?\/\*+)\s*@ts-expect-error/;
/** A directive that names its code. */
const PINNED_DIRECTIVE = /^(?:\/\/\/?|\{?\/\*+)\s*@ts-expect-error (TS\d{4,5})\b/;
/** Suppressions that would hide an error without saying which. */
const BLANKET = /@ts-(?:ignore|nocheck)\b/;
const DIAGNOSTIC = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/;
const GLOBAL_DIAGNOSTIC = /^error (TS\d+): (.*)$/;

export interface ProbeOptions {
  /** The probe tree; defaults to this package's `probes/`. */
  directory?: string;
  /** A `tsc` executable to check with (for example a TypeScript nightly); defaults to this package's. */
  tsc?: string;
}

export interface ProbeReport {
  /** True when the layout, the gate and the pin all passed. */
  ok: boolean;
  /** How many directives' lines report exactly one error, with the code the directive names. */
  pinned: number;
  /** One line per problem, prefixed with the step that found it. */
  problems: string[];
}

interface Diagnostic {
  /** Relative to the tree, with `/` separators. */
  file: string;
  line: number;
  code: string;
  message: string;
}

interface Directive {
  /** `<file>:<line>` of the line the directive applies to. */
  target: string;
  code: string;
  text: string;
}

/** The checker: an explicit executable, or the `tsc` of the TypeScript this package depends on. */
function tscCommand(tsc: string | undefined): { command: string; args: string[] } {
  if (tsc) return { command: tsc, args: [] };
  const require = createRequire(import.meta.url);
  const manifestPath = require.resolve("typescript/package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { bin: { tsc: string } };
  return { command: process.execPath, args: [join(dirname(manifestPath), manifest.bin.tsc)] };
}

/** Runs `tsc -p` in `cwd` and parses its diagnostics. Throws when the checker cannot run at all. */
function check(
  tsc: { command: string; args: string[] },
  cwd: string,
): { status: number; diagnostics: Diagnostic[]; global: string[]; output: string } {
  const result = spawnSync(
    tsc.command,
    [...tsc.args, "-p", join(cwd, "tsconfig.json"), "--noEmit", "--pretty", "false"],
    { cwd, encoding: "utf8" },
  );
  if (result.error) {
    throw new Error(`probes: could not start tsc (${tsc.command}): ${result.error.message}`, {
      cause: result.error,
    });
  }
  if (result.status === null) {
    throw new Error(`probes: tsc was stopped by ${result.signal ?? "a signal"}`);
  }
  const output = `${result.stdout}${result.stderr}`;
  const diagnostics: Diagnostic[] = [];
  const global: string[] = [];
  for (const line of output.split("\n")) {
    const match = DIAGNOSTIC.exec(line);
    if (match) {
      diagnostics.push({
        file: relative(cwd, resolve(cwd, match[1]!)).split(sep).join("/"),
        line: Number(match[2]),
        code: match[4]!,
        message: match[5]!,
      });
    } else if (GLOBAL_DIAGNOSTIC.test(line)) {
      global.push(line);
    }
  }
  return { status: result.status, diagnostics, global, output };
}

/** Every file under a folder of the tree, relative to the tree, with `/` separators. */
function filesOf(directory: string, folder: string): string[] {
  return readdirSync(join(directory, folder), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(directory, join(entry.parentPath, entry.name)).split(sep).join("/"))
    .toSorted();
}

/** Reads the directives of every file, reporting the ones the layout does not allow. */
function readLayout(
  directory: string,
  files: string[],
): { directives: Directive[]; problems: string[] } {
  const directives: Directive[] = [];
  const problems: string[] = [];
  for (const file of files) {
    if (!/\.[cm]?tsx?$/.test(file)) continue;
    const inCaught = file.startsWith("caught/");
    let count = 0;
    readFileSync(join(directory, file), "utf8")
      .split("\n")
      .forEach((text, index) => {
        const trimmed = text.trim();
        const where = `${file}:${index + 1}`;
        if (BLANKET.test(trimmed)) {
          problems.push(
            `layout: ${where}: @ts-ignore and @ts-nocheck hide errors; pin them with @ts-expect-error`,
          );
        }
        if (!DIRECTIVE.test(trimmed)) return;
        count++;
        const pinned = PINNED_DIRECTIVE.exec(trimmed);
        if (!inCaught) {
          problems.push(
            `layout: ${where}: directives belong in caught/; ${file} must type-check clean`,
          );
        } else if (!pinned) {
          problems.push(
            `layout: ${where}: a directive must name its code: // @ts-expect-error TSxxxx why`,
          );
        } else {
          directives.push({ target: `${file}:${index + 2}`, code: pinned[1]!, text: trimmed });
        }
      });
    if (inCaught && count === 0) {
      problems.push(
        `layout: ${file} pins no probe; caught/ files hold one @ts-expect-error per mistake`,
      );
    }
  }
  return { directives, problems };
}

/** Runs the probe suite over a tree and reports every problem it finds. */
export function runProbes(options: ProbeOptions = {}): ProbeReport {
  const requested = resolve(options.directory ?? PROBES_DIRECTORY);
  for (const required of ["tsconfig.json", ...FOLDERS]) {
    if (!existsSync(join(requested, required))) {
      throw new Error(`probes: ${requested} is not a probe tree: it has no ${required}`);
    }
  }
  // tsc reports paths relative to its real working directory (macOS's /tmp is /private/tmp), so
  // the tree is addressed by its real path too.
  const directory = realpathSync(requested);
  const tsc = tscCommand(options.tsc);
  const files = FOLDERS.flatMap((folder) => filesOf(directory, folder));
  const { directives, problems } = readLayout(directory, files);

  const gate = check(tsc, directory);
  if (gate.status !== 0) {
    const lines = gate.output.split("\n").filter((line) => line.trim() !== "");
    problems.push(
      `gate: tsc exited ${gate.status} (TS2578 is a mistake no longer caught; any other error is a false error)`,
      ...lines.map((line) => `gate: ${line}`),
    );
    return { ok: false, pinned: 0, problems };
  }

  // The copy sits inside the tree, so `unframework` and the base tsconfig resolve exactly as they do
  // for the original. Disabling rewrites the directive's name: TypeScript would still read
  // `@ts-expect-error-disabled` as a directive.
  const scratch = mkdtempSync(join(directory, ".pinned-"));
  let pinned = 0;
  try {
    for (const file of files) {
      const target = join(scratch, file);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(
        target,
        readFileSync(join(directory, file), "utf8").replaceAll(
          "@ts-expect-error",
          "@probe-disabled",
        ),
      );
    }
    writeFileSync(
      join(scratch, "tsconfig.json"),
      `${JSON.stringify({ extends: "../tsconfig.json", include: [...FOLDERS] }, null, 2)}\n`,
    );
    const unpinned = check(tsc, scratch);
    problems.push(...unpinned.global.map((line) => `pin: ${line}`));

    const actual = new Map<string, Diagnostic[]>();
    for (const diagnostic of unpinned.diagnostics) {
      const key = `${diagnostic.file}:${diagnostic.line}`;
      actual.set(key, [...(actual.get(key) ?? []), diagnostic]);
    }
    for (const { target, code, text } of directives) {
      const codes = (actual.get(target) ?? []).map((diagnostic) => diagnostic.code);
      if (codes.length === 1 && codes[0] === code) pinned++;
      else
        problems.push(
          `pin: ${target}: expected ${code}, got ${codes.join(", ") || "nothing"} (${text})`,
        );
      actual.delete(target);
    }
    for (const [key, diagnostics] of actual) {
      for (const { code, message } of diagnostics) {
        problems.push(`pin: ${key}: unexpected ${code} outside any directive: ${message}`);
      }
    }
    if (
      unpinned.status !== 0 &&
      unpinned.diagnostics.length === 0 &&
      unpinned.global.length === 0
    ) {
      problems.push(
        `pin: tsc exited ${unpinned.status} without a diagnostic: ${unpinned.output.trim()}`,
      );
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  return { ok: problems.length === 0, pinned, problems };
}

if (import.meta.main) {
  const tsc = process.argv
    .find((argument) => argument.startsWith("--tsc="))
    ?.slice("--tsc=".length);
  const report = runProbes({ tsc });
  if (!report.ok) {
    for (const problem of report.problems) console.error(problem);
    console.error(`probes: FAIL, ${report.problems.length} problem(s)`);
    process.exit(1);
  }
  console.log(
    `probes: OK, the gate is clean and ${report.pinned} caught probes are pinned to their codes`,
  );
}
