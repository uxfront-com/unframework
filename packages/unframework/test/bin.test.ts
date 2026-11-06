import { spawnSync } from "node:child_process";
import { accessSync, constants, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  bin: Record<string, string>;
  files: string[];
};
const BIN = fileURLToPath(new URL("../bin/unframework.js", import.meta.url));

const unframework = (...argv: string[]) =>
  spawnSync(process.execPath, [BIN, ...argv], { encoding: "utf8" });

describe("the bin", () => {
  it("is named by the manifest, and the tarball carries it", () => {
    expect(manifest.bin).toEqual({ unframework: "bin/unframework.js" });
    expect(manifest.files).toContain("bin");
    accessSync(BIN, constants.X_OK);
  });

  it("prints a diagnostic's entry", () => {
    const { status, stdout } = unframework("explain", "UF1002");
    expect(status).toBe(0);
    expect(stdout).toContain("UF1002 unsupported-syntax");
    expect(stdout).toContain("unframework.dev/diagnostics/UF1002");
  });

  it("exits 2 on an unknown code", () => {
    const { status, stderr } = unframework("explain", "UF0000");
    expect(status).toBe(2);
    expect(stderr).toContain("UF0000");
  });
});
