// `unframework visual [--target <t>]… [--baseline | --live] [--update] [--out <dir>]` (ADR-0087):
// every example on every target, compared live by default. The umbrella registers it, as it does
// `test` (ADR-0086), so `@unframework.dev/cli`, a layer below, never imports it.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { TARGET_NAMES } from "@unframework.dev/compiler";
import type { TargetName } from "@unframework.dev/compiler";

import { runVisual, VisualUsageError } from "./run.ts";

/** Where the command runs and writes: the shape of `@unframework.dev/cli`'s `Io`. */
export interface VisualIo {
  cwd: string;
  stdout(text: string): void;
  stderr(text: string): void;
}

/** The command's arguments, read. */
export interface VisualArguments {
  targets: TargetName[];
  pixels?: "live" | "baseline";
  update: boolean;
  out?: string;
}

/** Reads the arguments, throwing on a usage error: the CLI exits 2 with the message. */
export function parseVisualArguments(args: readonly string[]): VisualArguments {
  const parsed: VisualArguments = { targets: [], update: false };
  const value = (name: string, inline: string | undefined, index: number): string => {
    const next = inline ?? args[index];
    if (next === undefined || next === "" || next.startsWith("-")) {
      throw new VisualUsageError(
        `${name} needs a value, such as ${name} ${name === "--target" ? "react" : "reports/visual"}.`,
      );
    }
    return next;
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (arg === "--update") {
      parsed.update = true;
      continue;
    }
    if (arg === "--baseline" || arg === "--live") {
      const pixels = arg === "--baseline" ? "baseline" : "live";
      if (parsed.pixels && parsed.pixels !== pixels) {
        throw new VisualUsageError("--baseline and --live exclude each other: pass one.");
      }
      parsed.pixels = pixels;
      continue;
    }
    const option = /^(--target|--out)(?:=(.*))?$/s.exec(arg);
    if (option) {
      const name = option[1]!;
      const inline = option[2];
      const given = value(name, inline, inline === undefined ? (index += 1) : index);
      if (name === "--out") {
        if (parsed.out !== undefined) throw new VisualUsageError("--out is given twice.");
        parsed.out = given;
      } else if (!(TARGET_NAMES as readonly string[]).includes(given)) {
        throw new VisualUsageError(
          `unknown target ${given}. The targets are ${TARGET_NAMES.join(", ")}.`,
        );
      } else {
        parsed.targets.push(given as TargetName);
      }
      continue;
    }
    throw new VisualUsageError(`unknown argument "${arg}".`);
  }
  if (parsed.update && parsed.pixels === "live") {
    throw new VisualUsageError(
      "--update writes the committed baselines, which live pixels never read: drop --live.",
    );
  }
  return parsed;
}

/**
 * Runs the examples and gives the exit code: 0 when every example matches on every target, 1 when
 * one differs or declares props (UF7011), and 2 on a usage or configuration error, which it
 * reports, as the CLI's other commands do.
 */
export async function run(args: string[], io: VisualIo): Promise<number> {
  const parsed = parseVisualArguments(args);
  const result = await runVisual({
    root: io.cwd,
    targets: parsed.targets,
    update: parsed.update,
    stdout: (text) => io.stdout(text),
    ...(parsed.pixels ? { pixels: parsed.pixels } : {}),
    ...(parsed.out === undefined ? {} : { out: parsed.out }),
  });
  for (const diagnostic of result.diagnostics) {
    io.stderr(
      `${diagnostic.file}:${position(diagnostic.span.start, io.cwd, diagnostic.file)} ${diagnostic.severity} ${diagnostic.code}: ${diagnostic.message}\n`,
    );
  }
  return result.exitCode;
}

/** `line:column` of an offset, both from 1. */
function position(offset: number, root: string, file: string): string {
  const before = readFileSync(resolve(root, file), "utf8").slice(0, offset).split("\n");
  return `${before.length}:${before.at(-1)!.length + 1}`;
}
