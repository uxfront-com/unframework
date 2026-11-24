// `unframework preview [--target <t>]… [--port <n>]` (ADR-0088): starts the preview, prints its
// URL and runs until it is interrupted, then closes every server and exits 0.
// `unframework preview build [--target <t>]… [--out <dir>]` (ADR-0111) writes it as a static site
// instead, prints where and exits 0. The umbrella registers it, as it does `visual`, so
// `@unframework.dev/cli` never imports it.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { isTargetSelector, TARGET_SELECTORS, targetName } from "@unframework.dev/compiler";
import type { Diagnostic, TargetName } from "@unframework.dev/compiler";

import { VisualUsageError } from "../run.ts";
import { buildPreview } from "./build.ts";
import { startPreview } from "./index.ts";

/** Where the command runs and writes: the shape of `@unframework.dev/cli`'s `Io`. */
export interface PreviewIo {
  cwd: string;
  stdout(text: string): void;
  stderr(text: string): void;
}

/** The command's arguments, read. */
export interface PreviewArguments {
  /** Set when writing the static site (`preview build`) rather than serving the preview. */
  build?: true;
  targets: Array<TargetName>;
  /** The shell's port, when serving. */
  port?: number;
  /** The site's directory, when building, relative to the project's root. */
  out?: string;
}

/** An example value of each option, for a usage error. */
const EXAMPLE_VALUES: Readonly<Record<string, string>> = {
  "--target": "react",
  "--port": "5173",
  "--out": "dist/preview",
};

/** Reads the arguments, throwing on a usage error: the CLI exits 2 with the message. */
export function parsePreviewArguments(args: ReadonlyArray<string>): PreviewArguments {
  const build = args[0] === "build";
  const parsed: PreviewArguments = { ...(build ? { build } : {}), targets: [] };
  for (let index = build ? 1 : 0; index < args.length; index += 1) {
    const arg = args[index]!;
    const option = /^(--target|--port|--out)(?:=(.*))?$/s.exec(arg);
    if (!option) {
      throw new VisualUsageError(
        arg === "build"
          ? "build comes first: preview build [--target <t>]... [--out <dir>]."
          : `unknown argument "${arg}".`,
      );
    }
    const name = option[1]!;
    if (name === "--port" && build) {
      throw new VisualUsageError("--port is the served preview's: preview build takes --out.");
    }
    if (name === "--out" && !build) {
      throw new VisualUsageError("--out is preview build's: preview serves, and writes nothing.");
    }
    const value = option[2] ?? args[(index += 1)];
    if (value === undefined || value === "" || value.startsWith("-")) {
      throw new VisualUsageError(`${name} needs a value, such as ${name} ${EXAMPLE_VALUES[name]}.`);
    }
    if (name === "--out") {
      if (parsed.out !== undefined) {
        throw new VisualUsageError("--out is given twice.");
      }
      parsed.out = value;
    } else if (name === "--port") {
      if (parsed.port !== undefined) {
        throw new VisualUsageError("--port is given twice.");
      }
      if (!/^\d+$/.test(value) || Number(value) > 65_535) {
        throw new VisualUsageError(`--port takes a whole number from 0 to 65535, not ${value}.`);
      }
      parsed.port = Number(value);
    } else if (!isTargetSelector(value)) {
      throw new VisualUsageError(
        `unknown target ${value}. The targets are ${TARGET_SELECTORS.join(", ")}.`,
      );
    } else if (!parsed.targets.includes(targetName(value))) {
      parsed.targets.push(targetName(value));
    }
  }
  return parsed;
}

/**
 * A diagnostic as `unframework visual` prints it: `<file>:<line>:<column> <severity> <code>:
 * <message>`, the position from 1, or the file alone when it can no longer be read.
 */
export function diagnosticLine(diagnostic: Diagnostic, root: string): string {
  let position = "";
  try {
    const before = readFileSync(resolve(root, diagnostic.file), "utf8")
      .slice(0, diagnostic.span.start)
      .split("\n");
    position = `:${before.length}:${before.at(-1)!.length + 1}`;
  } catch {
    // Deleted since the catalogue read it: the file still says where to look.
  }
  return `${diagnostic.file}${position} ${diagnostic.severity} ${diagnostic.code}: ${diagnostic.message}\n`;
}

/**
 * Resolves on the process's first SIGINT or SIGTERM. A second one while the servers close exits at
 * once with 130, for a close that hangs.
 */
export function untilInterrupted(): { interrupted: Promise<void>; dispose(): void } {
  let interrupt!: () => void;
  const interrupted = new Promise<void>((resolve) => {
    interrupt = resolve;
  });
  let count = 0;
  const onSignal = () => {
    count += 1;
    if (count > 1) {
      process.exit(130);
    }
    interrupt();
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
  return {
    interrupted,
    dispose: () => {
      process.off("SIGINT", onSignal);
      process.off("SIGTERM", onSignal);
    },
  };
}

/**
 * Runs the preview until `stop` resolves, the process's interrupt by default, and gives the exit
 * code: 0 once every server has closed. With `build` first, writes the static site and gives 0
 * once it is written. A usage error, or a preview that cannot start or build, throws, which the
 * CLI reports with exit 2.
 */
export async function preview(
  args: Array<string>,
  io: PreviewIo,
  stop?: Promise<void>,
): Promise<number> {
  const parsed = parsePreviewArguments(args);
  if (parsed.build) {
    const built = await buildPreview({
      root: io.cwd,
      ...(parsed.targets.length ? { targets: parsed.targets } : {}),
      ...(parsed.out === undefined ? {} : { out: parsed.out }),
    });
    for (const diagnostic of built.diagnostics) {
      io.stderr(diagnosticLine(diagnostic, io.cwd));
    }
    io.stdout(`unframework preview build: ${built.out} (${built.targets.join(", ")})\n`);
    return 0;
  }
  const signals = stop ? undefined : untilInterrupted();
  try {
    const running = await startPreview({
      root: io.cwd,
      ...(parsed.targets.length ? { targets: parsed.targets } : {}),
      ...(parsed.port === undefined ? {} : { port: parsed.port }),
    });
    for (const diagnostic of running.diagnostics) {
      io.stderr(diagnosticLine(diagnostic, io.cwd));
    }
    io.stdout(
      [
        `unframework preview: ${running.url}`,
        ...running.frames.map((frame) => `  ${frame.target}: ${frame.origin}`),
        "Press Ctrl+C to stop.",
        "",
      ].join("\n"),
    );
    await (stop ?? signals!.interrupted);
    await running.close();
    io.stdout("unframework preview: stopped.\n");
    return 0;
  } finally {
    signals?.dispose();
  }
}
