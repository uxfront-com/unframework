import { describe, expect, it } from "vitest";

import { main } from "../src/index.ts";
import type { Command, Io } from "../src/index.ts";

/** An Io that keeps what the command prints. */
function io(cwd = "."): Io & { out: string; err: string } {
  const sink = {
    cwd,
    out: "",
    err: "",
    stdout: (text: string) => void (sink.out += text),
    stderr: (text: string) => void (sink.err += text),
  };
  return sink;
}

/** A command that records its arguments and exits with `code`. */
function command(code: number, seen: string[][] = []): Command {
  return {
    usage: "test [--target <t>]",
    summary: "Run the project's tests.",
    load: async () => ({
      run: async (args, each) => {
        seen.push(args);
        each.stdout("ran\n");
        return code;
      },
    }),
  };
}

describe("extra commands", () => {
  it("runs one by name, with its arguments and exit code", async () => {
    const seen: string[][] = [];
    const sink = io();
    const code = await main(
      ["test", "--target", "react"],
      sink,
      new Map([["test", command(1, seen)]]),
    );
    expect(code).toBe(1);
    expect(seen).toEqual([["--target", "react"]]);
    expect(sink.out).toBe("ran\n");
  });

  it("lists them in the usage text, after the built-in ones", async () => {
    const sink = io();
    expect(await main(["--help"], sink, new Map([["test", command(0)]]))).toBe(0);
    expect(sink.out).toContain("  test [--target <t>]\n      Run the project's tests.");
    expect(sink.out.indexOf("init")).toBeLessThan(sink.out.indexOf("test [--target"));
  });

  it("lists them when the command is unknown", async () => {
    const sink = io();
    expect(await main(["nope"], sink, new Map([["test", command(0)]]))).toBe(2);
    expect(sink.err).toContain('unknown command "nope"');
    expect(sink.err).toContain("test [--target <t>]");
  });

  it("exits 2 with the message when one fails to load", async () => {
    const sink = io();
    const broken: Command = {
      usage: "test",
      summary: "Run the project's tests.",
      load: () => Promise.reject(new Error("install @unframework.dev/testing")),
    };
    expect(await main(["test"], sink, new Map([["test", broken]]))).toBe(2);
    expect(sink.err).toBe("unframework test: install @unframework.dev/testing\n");
  });

  it("refuses one that would replace a built-in command", async () => {
    const sink = io();
    expect(await main(["build"], sink, new Map([["build", command(0)]]))).toBe(2);
    expect(sink.err).toContain("would replace a built-in one");
    expect(sink.out).toBe("");
  });

  it("leaves the usage text alone without any", async () => {
    const sink = io();
    expect(await main(["--help"], sink)).toBe(0);
    expect(sink.out).not.toContain("test");
  });
});
