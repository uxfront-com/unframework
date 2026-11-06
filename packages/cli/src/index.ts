// The `unframework` command line (plan §8.3, ADR-0076). Each command loads when it runs, so
// `explain` starts without the compiler.
import type { Io, RunCommand } from "./command.ts";

export type { Io } from "./command.ts";

interface Command {
  usage: string;
  summary: string;
  load(): Promise<{ run: RunCommand }>;
}

const COMMANDS: ReadonlyMap<string, Command> = new Map([
  [
    "build",
    {
      usage: "build [--type-oracle syntactic|tsgo]",
      summary: "Compile srcDir into outDir/<target>.",
      load: () => import("./build.ts"),
    },
  ],
  [
    "check",
    {
      usage: "check [--format pretty|json|sarif] [--type-oracle syntactic|tsgo]",
      summary: "Report diagnostics, and write no file.",
      load: () => import("./check.ts"),
    },
  ],
  [
    "explain",
    {
      usage: "explain <code>",
      summary: "Print a diagnostic's documentation.",
      load: () => import("./explain.ts"),
    },
  ],
]);

const USAGE = [
  "Usage: unframework <command>",
  "",
  ...[...COMMANDS.values()].flatMap(({ usage, summary }) => [`  ${usage}`, `      ${summary}`]),
  "",
].join("\n");

const PROCESS_IO: Io = {
  cwd: process.cwd(),
  stdout: (text) => void process.stdout.write(text),
  stderr: (text) => void process.stderr.write(text),
};

/**
 * Runs a command line, `argv` without Node and the script, and gives the exit code: 0 for success,
 * 1 for error diagnostics, 2 for a usage or configuration error. It never throws.
 */
export async function main(argv: readonly string[], io: Io = PROCESS_IO): Promise<number> {
  const [name, ...args] = argv;
  if (argv.includes("--help") || argv.includes("-h")) {
    io.stdout(USAGE);
    return 0;
  }
  const command = name === undefined ? undefined : COMMANDS.get(name);
  if (!command) {
    if (name !== undefined) io.stderr(`unframework: unknown command "${name}".\n\n`);
    io.stderr(USAGE);
    return 2;
  }
  try {
    const { run } = await command.load();
    return await run(args, io);
  } catch (error) {
    io.stderr(`unframework ${name}: ${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }
}
