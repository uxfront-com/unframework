// `create-unframework <dir>` (plan §5.2, ADR-0076). It keeps no dependencies, so `init` comes
// from the `@uxfront/unframework` the new project installs, and the two can't disagree on what
// it writes.
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";

/** Where the command runs and writes. Tests pass their own; the bin takes the process's. */
export interface Io {
  cwd: string;
  stdout(text: string): void;
  stderr(text: string): void;
}

/** The package that holds the authoring API and the `unframework` bin (ADR-0090). */
const PACKAGE = "@uxfront/unframework";

const USAGE = "Usage: create-unframework <dir>\n";

const MANIFEST = `${JSON.stringify(
  { private: true, type: "module", dependencies: { [PACKAGE]: "latest" } },
  null,
  2,
)}
`;

const PROCESS_IO: Io = {
  get cwd() {
    return process.cwd();
  },
  stdout: (text) => void process.stdout.write(text),
  stderr: (text) => void process.stderr.write(text),
};

/**
 * The `unframework` bin of the package installed in `project`. It looks nowhere else, since an
 * ancestor's copy or one on `NODE_PATH`, which pnpm's bin shims set, isn't the project's own.
 */
function projectBin(project: string): string | undefined {
  const manifest = join(project, "node_modules", PACKAGE, "package.json");
  if (!existsSync(manifest)) return undefined;
  // Whatever is installed under the name may not have this bin, like a release from before it.
  const bin: unknown = JSON.parse(readFileSync(manifest, "utf8")).bin?.unframework;
  return typeof bin === "string" ? join(dirname(manifest), bin) : undefined;
}

function create(dir: string, io: Io): number {
  const project = resolve(io.cwd, dir);
  const manifest = join(project, "package.json");
  if (lstatSync(manifest, { throwIfNoEntry: false })) {
    throw new Error(`${manifest} already exists.`);
  }
  mkdirSync(project, { recursive: true });
  writeFileSync(manifest, MANIFEST);

  const bin = projectBin(project);
  if (!bin) {
    io.stderr(
      `Wrote ${manifest}. Install its dependencies, then run "unframework init" in ${project}.\n`,
    );
    return 1;
  }
  const init = spawnSync(process.execPath, [bin, "init"], { cwd: project, encoding: "utf8" });
  if (init.error) throw init.error;
  io.stdout(init.stdout);
  io.stderr(init.stderr);
  return init.status ?? 2;
}

function directoryOf(argv: readonly string[]): string {
  const { positionals } = parseArgs({ args: [...argv], allowPositionals: true });
  const [dir] = positionals;
  // An empty name, like an unset shell variable, would resolve to the working directory.
  if (!dir || positionals.length > 1) throw new Error("It takes one directory.");
  return dir;
}

const messageOf = (error: unknown): string =>
  `create-unframework: ${error instanceof Error ? error.message : String(error)}\n`;

/**
 * Runs a command line, `argv` without Node and the script, and gives the exit code: 0 for success,
 * 1 when the project needs its dependencies installed before `init` can run, and 2 for a usage
 * error, a refusal or a failure. It never throws.
 */
export function main(argv: readonly string[], io: Io = PROCESS_IO): number {
  if (argv.includes("--help") || argv.includes("-h")) {
    io.stdout(USAGE);
    return 0;
  }
  let dir: string;
  try {
    dir = directoryOf(argv);
  } catch (error) {
    io.stderr(`${messageOf(error)}\n${USAGE}`);
    return 2;
  }
  try {
    return create(dir, io);
  } catch (error) {
    io.stderr(messageOf(error));
    return 2;
  }
}
