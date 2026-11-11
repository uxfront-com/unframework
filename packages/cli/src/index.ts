// The `unframework` command line (plan §8.3, ADR-0076). Each command loads when it runs, so
// `explain` starts without the compiler.
import type { Io, RunCommand } from "./command.ts";

export type { Io, RunCommand } from "./command.ts";

/**
 * A command: its usage line, its summary and how it loads. A package above this one adds its own
 * commands through `main`'s `extra` (ADR-0086), as the umbrella adds `test`.
 */
export interface Command {
  usage: string;
  summary: string;
  load(): Promise<{ run: RunCommand }>;
}

const COMMANDS: ReadonlyMap<string, Command> = new Map([
  [
    "build",
    {
      usage: "build [--package] [--type-oracle syntactic|tsgo]",
      summary: "Compile srcDir into outDir/<target>, and with --package into outDir/package.",
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
  [
    "init",
    {
      usage: "init [--force]",
      summary: "Scaffold a config, an example component, a tsconfig and AGENTS.md.",
      load: () => import("./init.ts"),
    },
  ],
]);

/** The usage text: every command, the built-in ones first. */
function usageOf(commands: ReadonlyMap<string, Command>): string {
  return [
    "Usage: unframework <command>",
    "",
    ...[...commands.values()].flatMap(({ usage, summary }) => [`  ${usage}`, `      ${summary}`]),
    "",
  ].join("\n");
}

const PROCESS_IO: Io = {
  // Read when a command needs it: a caller may change directory after importing this, and a working
  // directory that has gone is an error for `main` to report.
  get cwd() {
    return process.cwd();
  },
  stdout: (text) => void process.stdout.write(text),
  stderr: (text) => void process.stderr.write(text),
};

/**
 * Runs a command line, `argv` without Node and the script, and gives the exit code: 0 for success,
 * 1 for error diagnostics or failed tests, 2 for a usage or configuration error. It never throws.
 * `extra` adds commands by name, after the built-in ones, which it may not replace.
 */
export async function main(
  argv: readonly string[],
  io: Io = PROCESS_IO,
  extra: ReadonlyMap<string, Command> = new Map(),
): Promise<number> {
  const taken = [...extra.keys()].filter((name) => COMMANDS.has(name));
  if (taken.length) {
    io.stderr(
      `unframework: the extra command(s) ${taken.join(", ")} would replace a built-in one.\n`,
    );
    return 2;
  }
  const commands: ReadonlyMap<string, Command> = new Map([...COMMANDS, ...extra]);
  const [name, ...args] = argv;
  // What follows `--` is a command's to pass on (`test -- --help` is Vitest's help).
  const end = argv.indexOf("--");
  const own = end === -1 ? argv : argv.slice(0, end);
  if (own.includes("--help") || own.includes("-h")) {
    io.stdout(usageOf(commands));
    return 0;
  }
  const command = name === undefined ? undefined : commands.get(name);
  if (!command) {
    if (name !== undefined) io.stderr(`unframework: unknown command "${name}".\n\n`);
    io.stderr(usageOf(commands));
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
