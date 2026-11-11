import { mkdtempSync, readdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { cacheEnabled, probeCache, probeKey } from "./probe-cache.ts";
import type { ProbeInputs } from "./probe-cache.ts";

const INPUTS: ProbeInputs = {
  probe: [
    'import type { JSX as ReactJSX } from "react";',
    'export const c0: A<string, P<ReactJSX.IntrinsicElements, "a", "href">> = 3;',
    'export const c1: A<number, P<ReactJSX.IntrinsicElements, "a", "href">> = 3;',
  ].join("\n"),
  tsconfig: '{"compilerOptions":{"strict":true},"files":["probe.ts"]}',
  typescript: "7.0.2 /store/typescript@7.0.2/node_modules/typescript",
  files: ["lockfileVersion: '9.0'", "jsx-runtime.ts\nexport {};"],
};

describe("the key of a probe", () => {
  it("is the same for the same inputs", () => {
    expect(probeKey(INPUTS)).toBe(probeKey({ ...INPUTS, files: [...INPUTS.files] }));
    expect(probeKey(INPUTS)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes with one check's value", () => {
    const probe = INPUTS.probe.replace("A<number,", "A<boolean,");
    expect(probe).not.toBe(INPUTS.probe);
    expect(probeKey({ ...INPUTS, probe })).not.toBe(probeKey(INPUTS));
  });

  it("changes with the TypeScript version", () => {
    expect(
      probeKey({ ...INPUTS, typescript: INPUTS.typescript.replace("7.0.2 ", "7.0.3 ") }),
    ).not.toBe(probeKey(INPUTS));
  });

  it("changes with the tsconfig, the lockfile and a local type source", () => {
    const key = probeKey(INPUTS);
    expect(probeKey({ ...INPUTS, tsconfig: INPUTS.tsconfig.replace("true", "false") })).not.toBe(
      key,
    );
    expect(probeKey({ ...INPUTS, files: ["lockfileVersion: '9.1'", INPUTS.files[1]!] })).not.toBe(
      key,
    );
    expect(
      probeKey({ ...INPUTS, files: [INPUTS.files[0]!, "jsx-runtime.ts\nexport {}; "] }),
    ).not.toBe(key);
    expect(probeKey({ ...INPUTS, files: INPUTS.files.slice(0, 1) })).not.toBe(key);
  });

  it("keeps the inputs apart", () => {
    // The same text, split differently between two inputs.
    expect(probeKey({ ...INPUTS, probe: "ab", tsconfig: "c" })).not.toBe(
      probeKey({ ...INPUTS, probe: "a", tsconfig: "bc" }),
    );
  });
});

describe("the probe cache", () => {
  const root = mkdtempSync(join(tmpdir(), "uf-probe-cache-"));
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  let count = 0;
  const directory = () => join(root, String(count++));

  it("is off in CI and with UF_TYPES_CACHE=0", () => {
    expect(cacheEnabled({})).toBe(true);
    expect(cacheEnabled({ CI: "false" })).toBe(true);
    expect(cacheEnabled({ CI: "true" })).toBe(false);
    expect(cacheEnabled({ CI: "1" })).toBe(false);
    expect(cacheEnabled({ UF_TYPES_CACHE: "0" })).toBe(false);
    expect(cacheEnabled({ UF_TYPES_CACHE: "false" })).toBe(false);
  });

  it("reads back what it wrote, by key", () => {
    const cache = probeCache(directory(), {});
    expect(cache.read("a")).toBeUndefined();
    cache.write("a", "1021");
    cache.write("b", "");
    expect(cache.read("a")).toBe("1021");
    expect(cache.read("b")).toBe("");
    expect(cache.read("c")).toBeUndefined();
  });

  it("neither reads nor writes in CI", () => {
    const folder = directory();
    probeCache(folder, {}).write("a", "1021");
    const cache = probeCache(folder, { CI: "true" });
    expect(cache.read("a")).toBeUndefined();
    cache.write("b", "1");
    expect(readdirSync(folder)).toEqual(["a.txt"]);
  });

  it("misses on an entry that was torn or edited", () => {
    const folder = directory();
    const cache = probeCache(folder, {});
    cache.write("a", "1021");
    const file = join(folder, "a.txt");
    const text = readFileSync(file, "utf8");
    writeFileSync(file, text.replace(/1021$/, "1001"));
    expect(cache.read("a")).toBeUndefined();
    writeFileSync(file, text.slice(0, 10));
    expect(cache.read("a")).toBeUndefined();
    writeFileSync(file, "");
    expect(cache.read("a")).toBeUndefined();
  });

  it("keeps the newest eight entries, and no temporary files", () => {
    const folder = directory();
    const cache = probeCache(folder, {});
    for (let index = 0; index < 10; index++) {
      cache.write(`k${index}`, "1");
      // Older entries are older on disk, whatever the file system's clock resolution.
      utimesSync(join(folder, `k${index}.txt`), index, index);
    }
    cache.write("k10", "1");
    expect(readdirSync(folder).toSorted()).toEqual(
      ["k10", "k3", "k4", "k5", "k6", "k7", "k8", "k9"].map((key) => `${key}.txt`).toSorted(),
    );
  });
});
