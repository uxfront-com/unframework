// The artefact write policy (DESIGN §4.4), as plain functions every driver shares: the browser
// commands, the SSR harness and the compile project.
//
//   check mode   compare with the committed file; a missing file fails. Never write.
//   update mode  owners write their own artefacts (the compile project's goldens); the reference
//                target writes the shared ones and records each in the run's ledger; followers
//                compare against what the reference wrote in this same run, and fail if it
//                wrote nothing (it must run first, and must not be filtered out).
//
// Settling is per file. A shared expectation nothing settles any more (a renamed scenario's) is
// found from the corpus by the harness's compile project, which knows every case's scenarios
// and works in CI's shards too; a ledger of this run could only see what this run settled.
//
// Vitest's own `-u` cannot express this: its update flag is global to the run, so every
// project would overwrite the shared files (the screenshot ADR).
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, sep } from "node:path";

import { diffLines } from "../diff.ts";

/** Who may write an artefact. */
export type ArtefactRole =
  /** The sole producer, such as the compile project for each target's golden outputs. */
  | "owner"
  /** The reference target, which writes the artefacts every target shares. */
  | "reference"
  /** Any other target: it only ever compares. */
  | "follower";

/** How an artefact was settled. */
export type ArtefactStatus =
  | "matched"
  | "written"
  | "missing"
  | "missing-reference"
  | "mismatch"
  | "stale";

/** The result of settling an artefact. `message` is empty when it passed. */
export interface ArtefactOutcome {
  pass: boolean;
  status: ArtefactStatus;
  message: string;
}

/** Where and how an artefact is settled. */
export interface ArtefactContext {
  role: ArtefactRole;
  update: boolean;
  /** Paths in messages are relative to this directory. */
  root: string;
  /** Update mode, for the reference and its followers: the run's ledger directory. */
  ledgerDir?: string;
  /** The reference target's name, for messages. */
  reference?: string;
}

const UPDATE_HINT = "Run `pnpm test:update` and review the diff if the change is intended.";

/**
 * Settles one artefact. `actual` is what this run produced; `undefined` means the artefact must
 * not exist (an IR snapshot for a case with compile errors, a stale diagnostics.txt).
 */
export function settleArtefact(
  path: string,
  actual: string | undefined,
  context: ArtefactContext,
): ArtefactOutcome {
  const rel = display(path, context.root);
  if (!isAbsolute(path)) throw new Error(`An artefact path must be absolute: ${path}`);

  if (context.update && context.role !== "follower") {
    if (actual === undefined) {
      if (existsSync(path)) rmSync(path);
    } else {
      writeIfChanged(path, actual);
    }
    if (context.role === "reference") recordInLedger(path, context);
    return { pass: true, status: "written", message: "" };
  }

  if (context.update && !ledgerHas(path, context)) {
    return {
      pass: false,
      status: "missing-reference",
      message: `The reference target (${context.reference ?? "unknown"}) did not write ${rel} earlier in this run. In update mode the reference runs first (sequence.groupOrder) and must not be filtered out with --project.`,
    };
  }

  const exists = existsSync(path);
  if (actual === undefined) {
    return exists
      ? {
          pass: false,
          status: "stale",
          message: `Stale artefact ${rel}: this run no longer produces it. Run \`pnpm test:update\` to delete it.`,
        }
      : { pass: true, status: "matched", message: "" };
  }
  if (!exists) {
    const writer =
      context.role === "follower"
        ? ` (the reference target, ${context.reference ?? "unknown"}, writes it)`
        : "";
    return {
      pass: false,
      status: "missing",
      message: `Missing artefact ${rel}. Run \`pnpm test:update\` to write it${writer}.`,
    };
  }
  const expected = readFileSync(path, "utf8");
  if (expected === actual) return { pass: true, status: "matched", message: "" };
  const against = context.update ? `${rel}, as the reference wrote it in this run,` : rel;
  return {
    pass: false,
    status: "mismatch",
    message:
      `${against} differs from this run's output:\n${diffLines(expected, actual)}\n${context.update ? "" : UPDATE_HINT}`.trimEnd(),
  };
}

/**
 * Settles a directory that holds exactly a set of files (a target's golden outputs): no missing
 * file, no stale file, every file equal. In update mode it writes the files and deletes the
 * stale ones. Owners only: shared expectations are single files.
 */
export function settleArtefactDirectory(
  directory: string,
  files: ReadonlyMap<string, string>,
  context: { update: boolean; root: string },
): ArtefactOutcome {
  const existing = existsSync(directory) ? listFiles(directory) : [];
  const stale = existing.filter((file) => !files.has(file));

  if (context.update) {
    for (const file of stale) rmSync(join(directory, file));
    for (const [file, contents] of files) writeIfChanged(join(directory, file), contents);
    removeEmptyDirectories(directory);
    return { pass: true, status: "written", message: "" };
  }

  const problems: string[] = [];
  for (const file of stale) {
    problems.push(
      `Stale artefact ${display(join(directory, file), context.root)}: this run no longer produces it.`,
    );
  }
  for (const [file, contents] of [...files].sort(([a], [b]) => a.localeCompare(b))) {
    const outcome = settleArtefact(join(directory, file), contents, {
      role: "owner",
      update: false,
      root: context.root,
    });
    if (!outcome.pass) problems.push(outcome.message);
  }
  if (!problems.length) return { pass: true, status: "matched", message: "" };
  return {
    pass: false,
    status: problems.every((problem) => problem.startsWith("Missing")) ? "missing" : "mismatch",
    message: `${problems.join("\n\n")}\n${UPDATE_HINT}`,
  };
}

/** Writes a file only when its contents change, so update runs leave mtimes alone. */
export function writeIfChanged(path: string, contents: string | Uint8Array): boolean {
  if (existsSync(path)) {
    const current = readFileSync(path);
    const next = typeof contents === "string" ? Buffer.from(contents) : Buffer.from(contents);
    if (current.equals(next)) return false;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
  return true;
}

function ledgerEntry(path: string, context: ArtefactContext): string {
  if (!context.ledgerDir) {
    throw new Error(
      "Update mode needs the run's ledger directory to coordinate the reference and its followers.",
    );
  }
  const rel = relative(context.root, path);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`The artefact ${path} is outside the harness root ${context.root}.`);
  }
  return join(context.ledgerDir, rel);
}

function recordInLedger(path: string, context: ArtefactContext): void {
  const entry = ledgerEntry(path, context);
  mkdirSync(dirname(entry), { recursive: true });
  writeFileSync(entry, "");
}

function ledgerHas(path: string, context: ArtefactContext): boolean {
  return existsSync(ledgerEntry(path, context));
}

/** Every file under a directory, as relative paths with forward slashes, sorted. */
function listFiles(directory: string): string[] {
  return (readdirSync(directory, { recursive: true }) as string[])
    .filter((entry) => statSync(join(directory, entry)).isFile())
    .map((entry) => entry.split(sep).join("/"))
    .sort();
}

function removeEmptyDirectories(directory: string): void {
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) removeEmptyDirectories(path);
  }
  if (!readdirSync(directory).length) rmdirSync(directory);
}

function display(path: string, root: string): string {
  return relative(root, path).split(sep).join("/");
}
