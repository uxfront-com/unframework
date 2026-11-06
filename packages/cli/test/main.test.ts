import { describe, expect, it } from "vitest";

import { run } from "./helpers.ts";

describe("main", () => {
  it("prints the usage on --help, and exits 0", async () => {
    for (const argv of [["--help"], ["-h"], ["build", "--help"]]) {
      const { code, stdout, stderr } = await run(".", ...argv);
      expect(code).toBe(0);
      expect(stderr).toBe("");
      expect(stdout.indexOf("build")).toBeLessThan(stdout.indexOf("check"));
      expect(stdout.indexOf("check")).toBeLessThan(stdout.indexOf("explain"));
    }
  });

  it("exits 2 without a command", async () => {
    const { code, stdout, stderr } = await run(".");
    expect(code).toBe(2);
    expect(stdout).toBe("");
    expect(stderr).toContain("Usage: unframework <command>");
  });

  it.each([["nope"], ["constructor"], ["__proto__"]])("exits 2 on the command %s", async (name) => {
    const { code, stderr } = await run(".", name);
    expect(code).toBe(2);
    expect(stderr).toContain(`unknown command "${name}"`);
  });
});
