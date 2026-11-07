// The host port (`src/browser/host.ts`): the spec runtime reaches its runner only through it, so
// a project that installs no host fails with what to do, and the runtime's own modules name no
// Vitest module, which the Vitest host alone imports.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { host, installHost } from "../src/browser/host.ts";
import type { Host } from "../src/browser/host.ts";

const src = fileURLToPath(new URL("../src", import.meta.url));

/** Every import or export specifier that names a Vitest module, in a file. */
function vitestSpecifiers(file: string): string[] {
  return [...readFileSync(file, "utf8").matchAll(/["'](vitest(?:\/[^"']*)?)["']/g)].map(
    (match) => match[1]!,
  );
}

describe("the host port", () => {
  it("refuses to run with no host, naming the setup file that installs one", () => {
    expect(() => host()).toThrow("@unframework/testing/hosts/vitest");
  });

  it("hands out the host a project installed", () => {
    const installed = {} as Host;
    installHost(installed);
    expect(host()).toBe(installed);
  });

  it("keeps Vitest out of the runtime's own modules", () => {
    const browser = readdirSync(join(src, "browser")).map((file) => join(src, "browser", file));
    const files = [...browser, join(src, "setup.ts"), join(src, "index.ts")];
    expect(
      files.flatMap((file) => vitestSpecifiers(file).map((name) => `${file}: ${name}`)),
    ).toEqual([]);
  });
});
