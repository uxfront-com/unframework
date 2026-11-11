import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PROBES_DIRECTORY, runProbes } from "../scripts/run-probes.ts";

const PACKAGE = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(import.meta.url);

/** The directory of an installed package this one depends on. */
const packageDirectory = (name: string): string => dirname(require.resolve(`${name}/package.json`));

/**
 * The published package, as a consumer installs it: the build, the manifest with
 * `publishConfig.exports` in place, and the dependencies its types import. The declaration bundler
 * would drop `client.d.ts`, the reference to it and the vendored licence, so tsdown.config.ts puts
 * them back; this checks that it still does.
 */
let consumer: string;

/** Builds a package into the consumer's `node_modules`, with its published manifest. */
function installBuilt(directory: string, name: string): void {
  const installed = join(consumer, "node_modules", name);
  const tsdown = join(packageDirectory("tsdown"), "dist", "run.mjs");
  const build = spawnSync(
    process.execPath,
    [tsdown, "--out-dir", join(installed, "dist"), "--logLevel", "error"],
    { cwd: directory, encoding: "utf8" },
  );
  if (build.error) throw build.error;
  if (build.status !== 0) throw new Error(`tsdown failed:\n${build.stdout}${build.stderr}`);

  const manifest = JSON.parse(readFileSync(join(directory, "package.json"), "utf8")) as {
    exports: unknown;
    publishConfig: { exports: unknown };
  };
  manifest.exports = manifest.publishConfig.exports;
  writeFileSync(join(installed, "package.json"), JSON.stringify(manifest, null, 2));
}

beforeAll(() => {
  consumer = mkdtempSync(join(tmpdir(), "uf-published-"));
  installBuilt(PACKAGE, "@uxfront/unframework");
  // `@uxfront/unframework/config` types its config through the compiler's published leaf of types.
  installBuilt(packageDirectory("@unframework.dev/compiler"), "@unframework.dev/compiler");
  for (const dependency of ["csstype", "vue"]) {
    symlinkSync(packageDirectory(dependency), join(consumer, "node_modules", dependency), "dir");
  }

  // The probe tree, checked against the build instead of the sources.
  const probes = join(consumer, "probes");
  mkdirSync(probes);
  for (const folder of ["fixtures", "caught", "allowed"]) {
    cpSync(join(PROBES_DIRECTORY, folder), join(probes, folder), { recursive: true });
  }
  writeFileSync(
    join(probes, "tsconfig.json"),
    JSON.stringify({
      extends: join(PROBES_DIRECTORY, "tsconfig.json"),
      include: ["fixtures", "caught", "allowed"],
    }),
  );
}, 60_000);

afterAll(() => {
  if (consumer) rmSync(consumer, { recursive: true, force: true });
});

/** Each test runs the type checker over the packed package: seconds on a loaded CI runner. */
describe("the published package", { timeout: 30_000 }, () => {
  it("pins exactly what the sources pin", () => {
    const published = runProbes({ directory: join(consumer, "probes") });
    expect(published.problems).toEqual([]);
    expect(published.pinned).toBe(runProbes().pinned);
  });

  it("ships the vendored types verbatim, licence included", () => {
    const dist = join(consumer, "node_modules", "@uxfront/unframework", "dist");
    expect(readFileSync(join(dist, "vendor", "vue-jsx.d.ts"), "utf8")).toBe(
      readFileSync(join(PACKAGE, "src", "vendor", "vue-jsx.d.ts"), "utf8"),
    );
    expect(readFileSync(join(dist, "jsx-runtime.d.ts"), "utf8")).toMatch(
      /^\/\/\/ <reference path="\.\/client\.d\.ts" \/>\n/,
    );
  });

  it("loads no compiler through @uxfront/unframework/config", () => {
    const dist = join(consumer, "node_modules", "@uxfront/unframework", "dist");
    expect(readFileSync(join(dist, "config.js"), "utf8")).not.toMatch(/\bimport\b/);
  });
});
