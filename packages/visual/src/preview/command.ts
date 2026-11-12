// `unframework preview [--target <t>]… [--port <n>]` (ADR-0088): starts the preview, prints its
// URL and runs until it is interrupted, then closes every server and exits 0. The umbrella
// registers it, as it does `visual`, so `@unframework.dev/cli` never imports it.
import { TARGET_NAMES } from "@unframework.dev/compiler";
import type { TargetName } from "@unframework.dev/compiler";

import { VisualUsageError } from "../run.ts";
import { startPreview } from "./index.ts";

/** Where the command runs and writes: the shape of `@unframework.dev/cli`'s `Io`. */
export interface PreviewIo {
  cwd: string;
  stdout(text: string): void;
  stderr(text: string): void;
}

/** The command's arguments, read. */
export interface PreviewArguments {
  targets: TargetName[];
  port?: number;
}

/** Reads the arguments, throwing on a usage error: the CLI exits 2 with the message. */
export function parsePreviewArguments(args: readonly string[]): PreviewArguments {
  const parsed: PreviewArguments = { targets: [] };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    const option = /^(--target|--port)(?:=(.*))?$/s.exec(arg);
    if (!option) throw new VisualUsageError(`unknown argument "${arg}".`);
    const name = option[1]!;
    const value = option[2] ?? args[(index += 1)];
    if (value === undefined || value === "" || value.startsWith("-")) {
      throw new VisualUsageError(
        `${name} needs a value, such as ${name} ${name === "--target" ? "react" : "5173"}.`,
      );
    }
    if (name === "--port") {
      if (parsed.port !== undefined) throw new VisualUsageError("--port is given twice.");
      if (!/^\d+$/.test(value) || Number(value) > 65_535) {
        throw new VisualUsageError(`--port takes a whole number from 0 to 65535, not ${value}.`);
      }
      parsed.port = Number(value);
    } else if (!(TARGET_NAMES as readonly string[]).includes(value)) {
      throw new VisualUsageError(
        `unknown target ${value}. The targets are ${TARGET_NAMES.join(", ")}.`,
      );
    } else if (!parsed.targets.includes(value as TargetName)) {
      parsed.targets.push(value as TargetName);
    }
  }
  return parsed;
}

/**
 * Resolves on the process's first SIGINT or SIGTERM. A second one while the servers close exits at
 * once with 130, for a close that hangs.
 */
export function untilInterrupted(): { interrupted: Promise<void>; dispose(): void } {
  let interrupt!: () => void;
  const interrupted = new Promise<void>((resolve) => (interrupt = resolve));
  let count = 0;
  const onSignal = () => {
    count += 1;
    if (count > 1) process.exit(130);
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
 * code: 0 once every server has closed. A usage error or a preview that cannot start throws, which
 * the CLI reports with exit 2.
 */
export async function preview(
  args: string[],
  io: PreviewIo,
  stop?: Promise<void>,
): Promise<number> {
  const parsed = parsePreviewArguments(args);
  const signals = stop ? undefined : untilInterrupted();
  try {
    const running = await startPreview({
      root: io.cwd,
      ...(parsed.targets.length ? { targets: parsed.targets } : {}),
      ...(parsed.port === undefined ? {} : { port: parsed.port }),
    });
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
