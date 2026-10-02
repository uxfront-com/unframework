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
