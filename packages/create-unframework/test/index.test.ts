import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { main } from "../src/index.ts";

const packageDirectory = fileURLToPath(new URL("..", import.meta.url));
const umbrella = join(packageDirectory, "..", "unframework");
// The umbrella's own TypeScript. This package keeps no dependencies, not even for a test (plan §5.2).
const typescript = dirname(
  createRequire(join(umbrella, "package.json")).resolve("typescript/package.json"),
);

const SCAFFOLD = [
  "AGENTS.md",
  "src/Button.css",
  "src/Button.uf.tsx",
  "tsconfig.uf.json",
  "unframework.config.ts",
];

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function temporary(): string {
  const root = mkdtempSync(join(tmpdir(), "uf-create-"));
  roots.push(root);
  return root;
}

/** A directory whose `node_modules` holds the workspace's `unframework` and `typescript`. */
function linked(): string {
  const project = join(temporary(), "app");
  mkdirSync(join(project, "node_modules"), { recursive: true });
  symlinkSync(umbrella, join(project, "node_modules", "unframework"));
  symlinkSync(typescript, join(project, "node_modules", "typescript"));
  return project;
}

function run(cwd: string, ...argv: string[]): { code: number; stdout: string; stderr: string } {
  let stdout = "";
  let stderr = "";
  const code = main(argv, {
    cwd,
    stdout: (text) => void (stdout += text),
    stderr: (text) => void (stderr += text),
  });
  return { code, stdout, stderr };
}

function node(cwd: string, ...args: string[]): { status: number | null; output: string } {
  const { status, stdout, stderr } = spawnSync(process.execPath, args, {
    cwd,
    encoding: "utf8",
  });
  return { status, output: stdout + stderr };
}

describe("create-unframework", () => {
  it("creates a project whose check and type-check pass, through its own bin", () => {
    const project = linked();
    const created = node(
      dirname(project),
      join(packageDirectory, "bin", "create-unframework.js"),
      "app",
    );
    expect(created).toMatchObject({ status: 0 });
    for (const file of SCAFFOLD) expect(created.output).toContain(`Wrote ${file}\n`);
    for (const file of SCAFFOLD) expect(existsSync(join(project, file)), file).toBe(true);

    const bin = join(project, "node_modules", "unframework", "bin", "unframework.js");
    const check = node(project, bin, "check", "--format", "json");
    expect(check.status).toBe(0);
    const severities = (JSON.parse(check.output) as { severity: string }[]).map(
      ({ severity }) => severity,
    );
    expect(new Set(severities)).toEqual(new Set(["info"]));

    const tsc = join(project, "node_modules", "typescript", "bin", "tsc");
    expect(node(project, tsc, "--noEmit", "-p", "tsconfig.uf.json")).toEqual({
      status: 0,
      output: "",
    });
    // A type-check that read no file would pass too.
    expect(node(project, tsc, "-p", "tsconfig.uf.json", "--listFilesOnly").output).toContain(
      "src/Button.uf.tsx",
    );
    // The sources still type-check once `build` has written `dist`.
    expect(node(project, bin, "build")).toMatchObject({ status: 0 });
    expect(readdirSync(join(project, "dist")).toSorted()).toEqual([
      "angular",
      "astro",
      "qwik",
      "react",
      "solid",
      "svelte",
      "vue",
    ]);
    expect(existsSync(join(project, "dist", "vue", "Button.vue"))).toBe(true);
    expect(node(project, tsc, "--noEmit", "-p", "tsconfig.uf.json")).toEqual({
      status: 0,
      output: "",
    });

    writeFileSync(
      join(project, "src", "Misuse.uf.tsx"),
      'import Button from "./Button.uf.tsx";\n\nexport default function Misuse() {\n  return <Button label={1} />;\n}\n',
    );
    expect(node(project, tsc, "--noEmit", "-p", "tsconfig.uf.json").status).not.toBe(0);
  }, 120_000);

  it("writes a private package.json that depends on unframework", () => {
    const project = linked();
    expect(run(dirname(project), "app").code).toBe(0);
    expect(JSON.parse(readFileSync(join(project, "package.json"), "utf8"))).toEqual({
      private: true,
      type: "module",
      dependencies: { unframework: "latest" },
    });
  }, 60_000);

  it("says what to do when the project has no unframework yet", () => {
    const root = temporary();
    const { code, stderr } = run(root, "a/b");
    expect(code).toBe(1);
    expect(stderr).toContain("unframework init");
    expect(existsSync(join(root, "a", "b", "package.json"))).toBe(true);
    expect(existsSync(join(root, "a", "b", "AGENTS.md"))).toBe(false);
  });

  it("looks for the bin only in the project's own node_modules", () => {
    const root = temporary();
    mkdirSync(join(root, "node_modules"));
    symlinkSync(umbrella, join(root, "node_modules", "unframework"));
    const { code } = run(root, "app");
    expect(code).toBe(1);
    expect(existsSync(join(root, "app", "AGENTS.md"))).toBe(false);
  });

  it.each([
    ["no bin field", "{}"],
    ["a string for its bin", '{ "bin": "cli.js" }'],
    ["no entry in its bin", '{ "bin": {} }'],
  ])("treats an unframework with %s as not installed", (_, manifest) => {
    const root = temporary();
    const installed = join(root, "app", "node_modules", "unframework");
    mkdirSync(installed, { recursive: true });
    writeFileSync(join(installed, "package.json"), `${manifest}\n`);
    const { code, stderr } = run(root, "app");
    expect(code).toBe(1);
    expect(stderr).toContain('run "unframework init"');
    expect(existsSync(join(root, "app", "package.json"))).toBe(true);
  });

  it("passes on the exit code of a bin that fails", () => {
    const root = temporary();
    const installed = join(root, "app", "node_modules", "unframework");
    mkdirSync(installed, { recursive: true });
    writeFileSync(join(installed, "package.json"), '{ "bin": { "unframework": "bin.js" } }\n');
    writeFileSync(join(installed, "bin.js"), "process.exit(7);\n");
    expect(run(root, "app").code).toBe(7);
  });

  it("exits 2 when a signal kills the bin", () => {
    const root = temporary();
    const installed = join(root, "app", "node_modules", "unframework");
    mkdirSync(installed, { recursive: true });
    writeFileSync(join(installed, "package.json"), '{ "bin": { "unframework": "bin.js" } }\n');
    writeFileSync(join(installed, "bin.js"), 'process.kill(process.pid, "SIGKILL");\n');
    expect(run(root, "app").code).toBe(2);
  });

  it("reports a bin it can't start", () => {
    const project = linked();
    const { execPath } = process;
    process.execPath = join(project, "no-node");
    try {
      const { code, stderr } = run(dirname(project), "app");
      expect(code).toBe(2);
      expect(stderr).toContain("ENOENT");
    } finally {
      process.execPath = execPath;
    }
  });

  it("refuses a directory that has a package.json, and leaves it alone", () => {
    const root = temporary();
    writeFileSync(join(root, "package.json"), "{}\n");
    const { code, stderr } = run(root, ".");
    expect(code).toBe(2);
    expect(stderr).toContain("package.json");
    expect(readFileSync(join(root, "package.json"), "utf8")).toBe("{}\n");
    expect(existsSync(join(root, "AGENTS.md"))).toBe(false);
  });

  it("refuses a dangling package.json symlink, and writes nothing through it", () => {
    const root = temporary();
    const target = join(root, "elsewhere.json");
    symlinkSync(target, join(root, "package.json"));
    expect(run(root, ".").code).toBe(2);
    expect(existsSync(target)).toBe(false);
  });

  it("passes on init's refusal and exit code", () => {
    const project = linked();
    writeFileSync(join(project, "AGENTS.md"), "mine\n");
    const { code, stderr } = run(dirname(project), "app");
    expect(code).toBe(2);
    expect(stderr).toContain("AGENTS.md");
    expect(readFileSync(join(project, "AGENTS.md"), "utf8")).toBe("mine\n");
  }, 60_000);

  it("exits 2 when the directory is a file", () => {
    const root = temporary();
    writeFileSync(join(root, "app"), "mine\n");
    expect(run(root, "app").code).toBe(2);
    expect(readFileSync(join(root, "app"), "utf8")).toBe("mine\n");
  });

  it.each([[[]], [[""]], [["a", "b"]], [["--nope", "a"]]])(
    "exits 2 and prints the usage on %j",
    (argv) => {
      const root = temporary();
      const { code, stderr } = run(root, ...argv);
      expect(code).toBe(2);
      expect(stderr).toContain("Usage: create-unframework <dir>");
      expect(readdirSync(root)).toEqual([]);
    },
  );

  it.each([
    ["no directory", [], 2],
    ["no unframework yet", ["app"], 1],
    ["a package.json already there", ["."], 2],
  ])("exits with main's code through the bin, on %s", (_, argv, status) => {
    const root = temporary();
    if (status === 2 && argv.length > 0) writeFileSync(join(root, "package.json"), "{}\n");
    const bin = join(packageDirectory, "bin", "create-unframework.js");
    expect(node(root, bin, ...argv).status).toBe(status);
  });

  // The README and ADR-0076 name this exception to `check` exiting 0 on the example, and its fixes.
  it("fails on the example's ES module config under commonjs, until the file is renamed", () => {
    const project = linked();
    writeFileSync(join(project, "package.json"), '{ "type": "commonjs" }\n');
    const bin = join(project, "node_modules", "unframework", "bin", "unframework.js");
    expect(node(project, bin, "init")).toMatchObject({ status: 0 });
    const refused = node(project, bin, "check");
    expect(refused.status).toBe(2);
    expect(refused.output).toContain("UF7001");
    renameSync(join(project, "unframework.config.ts"), join(project, "unframework.config.mts"));
    expect(node(project, bin, "check")).toMatchObject({ status: 0 });
  }, 60_000);

  it.each(["--help", "-h"])("prints the usage on %s, and exits 0", (flag) => {
    const { code, stdout, stderr } = run(temporary(), flag);
    expect(code).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toContain("Usage: create-unframework <dir>");
  });
});
