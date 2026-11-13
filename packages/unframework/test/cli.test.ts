// The umbrella's command line (ADR-0086, ADR-0087, ADR-0088): the CLI's commands, `test`, which
// loads @unframework.dev/testing, and `visual` and `preview`, which load @unframework.dev/visual,
// both optional peer dependencies, when they run.
import { describe, expect, it } from "vitest";

import {
  main,
  PREVIEW_PACKAGES,
  previewCommand,
  TEST_PACKAGES,
  testCommand,
  VISUAL_PACKAGES,
  visualCommand,
} from "../src/cli.ts";

/** Runs a command line, keeping what it prints. */
async function run(
  argv: string[],
  load?: Parameters<typeof main>[2],
  visual?: Parameters<typeof main>[3],
  preview?: Parameters<typeof main>[4],
) {
  let stdout = "";
  let stderr = "";
  const io = {
    cwd: ".",
    stdout: (text: string) => void (stdout += text),
    stderr: (text: string) => void (stderr += text),
  };
  const code = await main(argv, io, load, visual, preview);
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
    expect(stdout).toContain(
      "  visual [--target <t>]... [--baseline | --live] [--update] [--out <dir>]",
    );
    expect(stdout).toContain("  preview [--target <t>]... [--port <n>]");
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

  it("runs visual through the visual package, with its arguments and exit code", async () => {
    const seen: string[][] = [];
    const { code } = await run(
      ["visual", "--target", "vue", "--baseline"],
      undefined,
      async () => ({
        run: async (args) => {
          seen.push(args);
          return 1;
        },
      }),
    );
    expect(code).toBe(1);
    expect(seen).toEqual([["--target", "vue", "--baseline"]]);
  });

  it("exits 2 and says what to install when the visual package is missing", async () => {
    const { code, stderr } = await run(["visual"], undefined, () =>
      Promise.reject(notFound("@unframework.dev/visual")),
    );
    expect(code).toBe(2);
    expect(stderr).toContain("unframework visual: Cannot find package '@unframework.dev/visual'");
    expect(stderr).toContain(`npm install --save-dev ${VISUAL_PACKAGES.join(" ")}`);
    expect(VISUAL_PACKAGES).toEqual(["@unframework.dev/visual", ...TEST_PACKAGES]);
  });

  it("loads the visual package lazily", () => {
    let loaded = false;
    visualCommand(async () => {
      loaded = true;
      return { run: async () => 0 };
    });
    expect(loaded).toBe(false);
  });

  it("runs preview through the visual package's preview, with its arguments and exit code", async () => {
    const seen: string[][] = [];
    const { code } = await run(
      ["preview", "--target", "vue", "--port", "5173"],
      undefined,
      undefined,
      async () => ({
        run: async (args) => {
          seen.push(args);
          return 0;
        },
      }),
    );
    expect(code).toBe(0);
    expect(seen).toEqual([["--target", "vue", "--port", "5173"]]);
  });

  // The entry loads Vitest's Node API, which takes seconds cold.
  it(
    "loads preview from the visual package's ./cli entry, as its preview export",
    { timeout: 60_000 },
    async () => {
      const module = await import("@unframework.dev/visual/cli");
      const loaded = await previewCommand().load();
      expect(loaded.run).toBe(module.preview);
    },
  );

  it("exits 2 and says what to install when the visual package or Vite is missing", async () => {
    const { code, stderr } = await run(["preview"], undefined, undefined, () =>
      Promise.reject(notFound("vite")),
    );
    expect(code).toBe(2);
    expect(stderr).toContain("unframework preview: Cannot find package 'vite'");
    expect(stderr).toContain(`npm install --save-dev ${PREVIEW_PACKAGES.join(" ")}`);
    expect(PREVIEW_PACKAGES).toEqual([...VISUAL_PACKAGES, "vite"]);
  });

  it("loads the preview lazily", () => {
    let loaded = false;
    previewCommand(async () => {
      loaded = true;
      return { run: async () => 0 };
    });
    expect(loaded).toBe(false);
  });
});
