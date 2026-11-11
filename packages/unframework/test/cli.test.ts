// The umbrella's command line (ADR-0086): the CLI's commands, and `test`, which loads
// @unframework.dev/testing, an optional peer dependency, when it runs.
import { describe, expect, it } from "vitest";

import { main, TEST_PACKAGES, testCommand } from "../src/cli.ts";

/** Runs a command line, keeping what it prints. */
async function run(argv: string[], load?: Parameters<typeof main>[2]) {
  let stdout = "";
  let stderr = "";
  const io = {
    cwd: ".",
    stdout: (text: string) => void (stdout += text),
    stderr: (text: string) => void (stderr += text),
  };
  const code = await main(argv, io, load);
  return { code, stdout, stderr };
}

/** The error Node gives an import whose package isn't installed. */
function notFound(specifier: string): Error {
  return Object.assign(new Error(`Cannot find package '${specifier}' imported from /p/cli.js`), {
    code: "ERR_MODULE_NOT_FOUND",
  });
}

describe("the umbrella's command line", () => {
  it("lists test beside the CLI's own commands", async () => {
    const { code, stdout } = await run(["--help"]);
    expect(code).toBe(0);
    expect(stdout).toContain("  build [--package]");
    expect(stdout).toContain("  test [--target <t>]... [--update] [-- <vitest args>]");
  });

  it("runs test through the testing package, with its arguments and exit code", async () => {
    const seen: string[][] = [];
    const { code } = await run(["test", "--target", "react"], async () => ({
      run: async (args) => {
        seen.push(args);
        return 1;
      },
    }));
    expect(code).toBe(1);
    expect(seen).toEqual([["--target", "react"]]);
  });

  it("exits 2 and says what to install when the testing package is missing", async () => {
    const { code, stderr, stdout } = await run(["test"], () =>
      Promise.reject(notFound("@unframework.dev/testing")),
    );
    expect(code).toBe(2);
    expect(stdout).toBe("");
    expect(stderr).toContain("Cannot find package '@unframework.dev/testing'");
    expect(stderr).toContain(`npm install --save-dev ${TEST_PACKAGES.join(" ")}`);
    expect(stderr).toContain("  react: react, react-dom, @vitejs/plugin-react");
    expect(stderr).toContain("  angular: @angular/core");
  });

  it("says the same when the runner the testing package needs is missing", async () => {
    const { code, stderr } = await run(["test"], () => Promise.reject(notFound("vitest")));
    expect(code).toBe(2);
    expect(stderr).toContain("Cannot find package 'vitest'");
    expect(stderr).toContain("unframework test needs @unframework.dev/testing, vitest");
  });

  it("reports any other failure to load as an error of its own", async () => {
    const { code, stderr } = await run(["test"], () => Promise.reject(new SyntaxError("bad")));
    expect(code).toBe(2);
    expect(stderr).toBe("unframework test: bad\n");
  });

  it("loads the testing package lazily", () => {
    let loaded = false;
    testCommand(async () => {
      loaded = true;
      return { run: async () => 0 };
    });
    expect(loaded).toBe(false);
  });
});
