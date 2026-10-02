// The toolchain's Vite configuration outside Vitest, as a user's dev server would run it: Vitest
// runs the Qwik plugin in its `test` mode, which hides what a plain server does differently.
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { SsrRenderer } from "@unframework/codegen";
import { createServer, resolveConfig } from "vite";
import { describe, expect, it } from "vitest";

import { toolchain } from "../src/toolchain/index.ts";

// A project root with no `root.tsx` and no `entry.ssr.tsx`: the tests import what they render.
const root = fileURLToPath(new URL("fixtures", import.meta.url));
const context = { root, toolchainDir: "/unused" };
const renderer = fileURLToPath(new URL("../src/toolchain/server.ts", import.meta.url));

describe("the Vite configuration on a plain Vite server", () => {
  it("renders on the server without Qwik's inspector attributes", async () => {
    const server = await createServer({
      ...(await toolchain.vite("ssr", context)),
      root,
      configFile: false,
      logLevel: "silent",
      appType: "custom",
      server: { middlewareMode: true, hmr: false, ws: false },
    });
    try {
      const { renderToString } = (await server.ssrLoadModule(renderer)) as {
        renderToString: SsrRenderer;
      };
      const { default: Greeting } = await server.ssrLoadModule(join(root, "Greeting.tsx"));
      const html = await renderToString(Greeting, { props: { name: "Vite" } });
      expect(html).toMatch(/>Hello, Vite!<\/p>$/);
      expect(html).not.toContain("data-qwik-inspector");
    } finally {
      await server.close();
    }
  });

  it("keeps the inspector off in the browser too", async () => {
    const config = await resolveConfig(
      {
        ...(await toolchain.vite("browser", context)),
        root,
        configFile: false,
        logLevel: "silent",
      },
      "serve",
    );
    expect(config.define?.["globalThis.qInspector"]).toBe(false);
  });
});
