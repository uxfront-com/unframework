import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { inlinedQrl } from "@qwik.dev/core";
import { componentQrl } from "@qwik.dev/core/internal";
import type { Plugin } from "vite";
import { describe, expect, it } from "vitest";

import { asComponent } from "../src/toolchain/component.ts";
import defaultToolchain, { toolchain } from "../src/toolchain/index.ts";

const require = createRequire(import.meta.url);
const context = {
  toolchainDir: "/unused",
  root: fileURLToPath(new URL("fixtures", import.meta.url)),
};

function isPlugin(option: unknown): option is Plugin {
  return typeof option === "object" && option !== null && "name" in option;
}

describe("the Qwik toolchain", () => {
  it("is the default export too, named after the target", () => {
    expect(defaultToolchain).toBe(toolchain);
    expect(toolchain.name).toBe("qwik");
  });

  it("names runtime entries that resolve through the package's exports", () => {
    expect(require.resolve(toolchain.client)).toBe(
      fileURLToPath(new URL("../src/toolchain/client.ts", import.meta.url)),
    );
    expect(require.resolve(toolchain.server)).toBe(
      fileURLToPath(new URL("../src/toolchain/server.ts", import.meta.url)),
    );
  });

  it.each(["browser", "ssr"] as const)(
    "gives %s projects Qwik's plugin and one Qwik runtime",
    async (mode) => {
      const config = await toolchain.vite(mode, context);
      const plugins = (config.plugins ?? []).flat().filter(isPlugin);
      expect(plugins.map((plugin) => plugin.name)).toContain("vite-plugin-qwik");
      expect(config.resolve?.dedupe).toEqual(["@qwik.dev/core"]);
      // Qwik keeps its runtime out of pre-bundling; nothing may be added back.
      expect(config.optimizeDeps).toBeUndefined();
    },
  );
});

describe("the component a test mounts or renders", () => {
  it("is a component$(), as the target emits", () => {
    // What component$() compiles to, without the optimizer.
    const Greeting = componentQrl(inlinedQrl(() => null, "s_greeting"));
    expect(asComponent(Greeting)).toBe(Greeting);
  });

  it("is rejected, naming what it is, when it is anything else", () => {
    expect(() => asComponent(undefined)).toThrow(
      "Expected a Qwik component created by component$(), received undefined.",
    );
    expect(() => asComponent(null)).toThrow("received null.");
    // A plain function would render as an inline component, which the target never emits.
    expect(() => asComponent(function Inline() {})).toThrow("received the function Inline.");
  });
});

describe("the toolchain modules Qwik's optimizer compiles", () => {
  // Qwik's plugin compiles a dependency's JavaScript only in a `*.qwik.js` file. Installed, a
  // module that calls `component$` or `$()` under another name reaches the page as written, and
  // throws "Optimizer should replace all usages of $()". tsdown keeps the source's name.
  const dir = new URL("../src/toolchain/", import.meta.url);
  const IMPORT = /^import\s+\{([^}]*)\}\s+from\s+"@qwik\.dev\/core";/gm;

  function dollarImports(source: string): string[] {
    return [...source.matchAll(IMPORT)].flatMap((match) =>
      match[1]!
        .split(",")
        .map((name) => name.trim())
        .filter((name) => name.endsWith("$") && !name.startsWith("type ")),
    );
  }

  it("are named *.qwik.ts, so their build is *.qwik.js", () => {
    const files = readdirSync(dir).filter((file) => file.endsWith(".ts"));
    const compiled = files.filter(
      (file) => dollarImports(readFileSync(new URL(file, dir), "utf8")).length,
    );
    expect(compiled.toSorted()).toEqual(["host.qwik.ts", "listener.qwik.ts"]);
    expect(files.filter((file) => file.endsWith(".qwik.ts")).toSorted()).toEqual(
      compiled.toSorted(),
    );
  });

  it("finds a value import of a $ function, and not a type import", () => {
    expect(dollarImports('import { $, noSerialize } from "@qwik.dev/core";')).toEqual(["$"]);
    expect(dollarImports('import { component$ } from "@qwik.dev/core";')).toEqual(["component$"]);
    expect(dollarImports('import { type QRL$, jsx } from "@qwik.dev/core";')).toEqual([]);
    expect(dollarImports('import type { QRL } from "@qwik.dev/core";')).toEqual([]);
  });
});
