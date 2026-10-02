import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { typecheckWithTsgo } from "../src/toolchain-node/index.ts";

const temporaries: string[] = [];
afterAll(() => {
  for (const directory of temporaries.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

/** A fresh directory under the OS's temporary directory, which macOS reaches through a symlink. */
function temporaryDir(): string {
  const directory = mkdtempSync(join(tmpdir(), "uf-tsgo-"));
  temporaries.push(directory);
  return directory;
}

const scratch = temporaryDir();

function write(name: string, contents: string): string {
  const path = join(scratch, name);
  writeFileSync(path, contents);
  return path;
}

const check = (toolchainDir: string, files: readonly string[]) =>
  typecheckWithTsgo(files, { toolchainDir, root: toolchainDir });

/** The workspace's own TypeScript 7, installed into a toolchain directory of the test's own. */
function realToolchain(compilerOptions: object): string {
  const typescript = dirname(createRequire(import.meta.url).resolve("typescript/package.json"));
  const toolchainDir = temporaryDir();
  writeFileSync(join(toolchainDir, "package.json"), `{ "name": "private", "private": true }\n`);
  writeFileSync(join(toolchainDir, "tsconfig.json"), JSON.stringify({ compilerOptions }));
  mkdirSync(join(toolchainDir, "node_modules"));
  symlinkSync(typescript, join(toolchainDir, "node_modules/typescript"), "dir");
  return toolchainDir;
}

const strictOptions = { target: "es2024", lib: ["es2024"], strict: true, types: [] };

describe("typecheckWithTsgo with TypeScript 7", { timeout: 60_000 }, () => {
  const toolchainDir = realToolchain(strictOptions);

  it("reports each file's diagnostics, under the toolchain's options, in one run", async () => {
    const clean = write("Clean.ts", "export const count: number = 1;\n");
    const script = write("Script.ts", 'export const count: number = "one";\n');
    // Only an error under the toolchain's `strict`, so it proves the temporary tsconfig extends it.
    const strict = write("Strict.ts", "export function same(value) {\n  return value;\n}\n");
    const nested = write(
      "Nested.ts",
      [
        "interface Props { user: { name: string } }",
        "const props = { user: { name: 1 } };",
        "export const checked: Props = props;",
        "",
      ].join("\n"),
    );
    const results = await check(toolchainDir, [clean, script, strict, nested]);
    expect(Object.fromEntries(results)).toEqual({
      [clean]: [],
      [script]: [
        {
          message: "Type 'string' is not assignable to type 'number'.",
          line: 1,
          column: 14,
          code: "TS2322",
        },
      ],
      [strict]: [
        {
          message: "Parameter 'value' implicitly has an 'any' type.",
          line: 1,
          column: 22,
          code: "TS7006",
        },
      ],
      // The elaboration stays in the message.
      [nested]: [
        {
          message: expect.stringMatching(/^Type .+ is not assignable to type 'Props'\.\n {2}\S/),
          line: 3,
          column: 14,
          code: "TS2322",
        },
      ],
    });
    expect(readdirSync(join(toolchainDir, ".uf-tmp"))).toEqual([]);
  });

  it("reports an error in a file a checked file imports, under that file", async () => {
    const helper = write("helper.ts", 'export const name: number = "one";\n');
    const uses = write("Uses.ts", 'import { name } from "./helper.ts";\nexport const n = name;\n');
    const clean = write("Fine.ts", "export const fine = 1;\n");
    const results = await check(
      realToolchain({ ...strictOptions, allowImportingTsExtensions: true, noEmit: true }),
      [uses, clean],
    );
    expect(results.get(uses)).toEqual([]);
    expect(results.get(clean)).toEqual([]);
    // Under the path tsgo printed for it, whichever spelling of the file that is.
    const others = [...results.keys()].filter((key) => key !== uses && key !== clean);
    expect(others.map((key) => realpathSync(key))).toEqual([realpathSync(helper)]);
    expect(results.get(others[0]!)).toEqual([
      {
        message: "Type 'string' is not assignable to type 'number'.",
        line: 1,
        column: 14,
        code: "TS2322",
      },
    ]);
  });

  // tsgo checks on without an option it cannot read, and the file itself is clean: only the
  // tsconfig's own entry says the check was not the one configured.
  it("reports a broken toolchain tsconfig against that tsconfig", async () => {
    const broken = realToolchain({ ...strictOptions, strict: "yes", notAnOption: true });
    const clean = write("Configured.ts", "export const one = 1;\n");
    const results = await check(broken, [clean]);
    expect(Object.fromEntries(results)).toEqual({
      [clean]: [],
      [join(realpathSync(broken), "tsconfig.json")]: [
        {
          message: "Compiler option 'strict' requires a value of type boolean.",
          line: 1,
          column: expect.any(Number),
          code: "TS5024",
        },
        {
          message: "Unknown compiler option 'notAnOption'.",
          line: 1,
          column: expect.any(Number),
          code: "TS5023",
        },
      ],
    });
  });

  it("reports a diagnostic without a file against the tsconfig the run used", async () => {
    // No library: the global types are missing, an error that belongs to no file.
    const results = await check(realToolchain({ ...strictOptions, lib: [], noLib: true }), [
      write("NoLib.ts", "export const one = 1;\n"),
    ]);
    const [, ...others] = [...results.keys()];
    expect(others).toEqual([expect.stringMatching(/\/\.uf-tmp\/typecheck-[^/]+\/tsconfig\.json$/)]);
    expect(results.get(others[0]!)).toContainEqual({
      message: "Cannot find global type 'Array'.",
      code: "TS2318",
    });
  });
});

/** A toolchain directory with a tsconfig and, optionally, a fake `typescript` running `tsc`. */
function fakeToolchain(options: { version?: string; tsc?: string; tsconfig?: boolean }): string {
  const directory = temporaryDir();
  writeFileSync(join(directory, "package.json"), `{ "name": "fake", "private": true }`);
  if (options.tsconfig ?? true) writeFileSync(join(directory, "tsconfig.json"), "{}");
  if (options.version) {
    const typescript = join(directory, "node_modules/typescript");
    mkdirSync(join(typescript, "bin"), { recursive: true });
    writeFileSync(
      join(typescript, "package.json"),
      JSON.stringify({ name: "typescript", version: options.version, bin: { tsc: "./bin/tsc" } }),
    );
    // Node runs the launcher, as it runs TypeScript's own.
    writeFileSync(join(typescript, "bin/tsc"), options.tsc ?? "");
  }
  return directory;
}

/** A fake tsc that prints `stdout` (and `stderr`) and exits with `code`. */
const printing = (stdout: string, code: number, stderr = "") =>
  `process.stdout.write(${JSON.stringify(stdout)});\nprocess.stderr.write(${JSON.stringify(stderr)});\nprocess.exitCode = ${code};\n`;

const files = [write("A.tsx", ""), write("B.tsx", "")];

describe("tsgo's output", () => {
  it("is read relative to the directory tsgo runs in, elaborations included", async () => {
    const [first, second] = files;
    // tsgo prints paths relative to its working directory, which is a real path.
    const tsc = [
      'const { relative } = require("node:path");',
      "process.stdout.write([",
      `  relative(process.cwd(), ${JSON.stringify(first)}) + "(3,7): error TS2322: Type 'string' is not assignable to type 'number'.",`,
      `  "  Property 'x' is missing.",`,
      `  "",`,
      `  ${JSON.stringify(`${second}(1,1): error TS2304: Cannot find name 'greet'.`)},`,
      `  "/elsewhere/Imported.ts(2,1): error TS2304: Cannot find name 'missing'.",`,
      '].join("\\n"));',
      "process.exitCode = 2;",
    ].join("\n");
    const results = await check(fakeToolchain({ version: "7.0.2", tsc }), files);
    expect(Object.fromEntries(results)).toEqual({
      [first!]: [
        {
          message: "Type 'string' is not assignable to type 'number'.\n  Property 'x' is missing.",
          line: 3,
          column: 7,
          code: "TS2322",
        },
      ],
      [second!]: [{ message: "Cannot find name 'greet'.", line: 1, column: 1, code: "TS2304" }],
      // A file a checked file imports gets an entry of its own.
      "/elsewhere/Imported.ts": [
        { message: "Cannot find name 'missing'.", line: 2, column: 1, code: "TS2304" },
      ],
    });
  });

  it("reports a diagnostic without a file against the run's tsconfig", async () => {
    const tsc = printing("error TS5083: Cannot read file 'x.json'.\n", 1);
    const results = await check(installed(tsc), files);
    const [tsconfig] = [...results.keys()].filter((key) => !files.includes(key));
    expect(tsconfig).toMatch(/\/\.uf-tmp\/typecheck-[^/]+\/tsconfig\.json$/);
    expect(Object.fromEntries(results)).toEqual({
      [files[0]!]: [],
      [files[1]!]: [],
      [tsconfig!]: [{ message: "Cannot read file 'x.json'.", code: "TS5083" }],
    });
  });

  it("keys a file tsgo saw through a symlink by the path it was given", async () => {
    const real = temporaryDir();
    const link = `${real}-link`;
    temporaries.push(link);
    writeFileSync(join(real, "A.tsx"), "");
    symlinkSync(real, link);
    const given = join(link, "A.tsx");
    const seen = join(realpathSync(real), "A.tsx");
    const tsc = printing(`${seen}(1,1): error TS2304: Cannot find name 'x'.\n`, 2);
    const results = await check(fakeToolchain({ version: "7.0.2", tsc }), [given]);
    expect([...results.keys()]).toEqual([given]);
    expect(results.get(given)).toHaveLength(1);
  });
});

/** A fake toolchain with TypeScript 7 installed. */
const installed = (tsc = "") => fakeToolchain({ version: "7.0.2", tsc });

describe("a tsgo run that cannot be trusted", () => {
  it("rejects a check over no files", async () => {
    await expect(check(installed(), [])).rejects.toThrow(/received no files/);
  });

  it("rejects files that do not exist", async () => {
    await expect(check(installed(), ["/nowhere/Missing.tsx"])).rejects.toThrow(
      "typecheck received files that do not exist:\n/nowhere/Missing.tsx",
    );
  });

  it("rejects when TypeScript is not installed", async () => {
    await expect(check(fakeToolchain({}), files)).rejects.toThrow(/TypeScript 7 is not installed/);
  });

  it("rejects TypeScript 6, which is not tsgo", async () => {
    await expect(check(fakeToolchain({ version: "6.0.3" }), files)).rejects.toThrow(
      /Expected TypeScript 7 \(tsgo\) for .*, found 6\.0\.3/,
    );
  });

  it("rejects when the toolchain has no tsconfig", async () => {
    const directory = fakeToolchain({ version: "7.0.2", tsconfig: false });
    await expect(check(directory, files)).rejects.toThrow(/tsconfig\.json does not exist/);
  });

  it("rejects output it cannot read", async () => {
    const tsc = printing("panic: the checker crashed\n", 1);
    await expect(check(installed(tsc), files)).rejects.toThrow(
      /cannot read:\npanic: the checker crashed/,
    );
  });

  it("rejects anything written to stderr", async () => {
    const tsc = printing("", 2, "panic: runtime error\n");
    await expect(check(installed(tsc), files)).rejects.toThrow(
      /wrote to stderr \(exit code 2\):\npanic: runtime error/,
    );
  });

  it("rejects a failure exit that reported nothing, and still cleans up", async () => {
    const directory = installed(printing("", 3));
    await expect(check(directory, files)).rejects.toThrow(/exited with code 3 without reporting/);
    expect(readdirSync(join(directory, ".uf-tmp"))).toEqual([]);
  });
});
