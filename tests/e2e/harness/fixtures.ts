import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { test as base } from "@playwright/test";

import { workDir } from "./apps.ts";
import { createEditor, type Edit, type Watcher } from "./edit.ts";
import { HOST, recordPort } from "./ports.ts";

export { expect } from "@playwright/test";

/** The part of Vite's API the fixture uses: the suite has no workspace dependency on Vite. */
interface ViteServer {
  listen(): Promise<unknown>;
  close(): Promise<void>;
  httpServer: { address(): AddressInfo };
  watcher: Watcher;
}

interface DevServer {
  url: string;
  copy: string;
  watcher: Watcher;
}

export const test = base.extend<{ edit: Edit }, { devServer: DevServer }>({
  // Worker-scoped, so that a project's specs share one server.
  devServer: [
    // oxlint-disable-next-line no-empty-pattern -- Playwright reads the fixtures from this pattern.
    async ({}, use, workerInfo) => {
      const { app, mode } = workerInfo.project.metadata as { app: string; mode: string };
      const work = workDir();
      const copy = join(work, app);
      if (!existsSync(join(copy, "node_modules"))) {
        throw new Error(`${copy} isn't installed: run prepare-apps first.`);
      }
      // The copy's own Vite, so that the app runs on what it installed (ADR-0079).
      const require = createRequire(join(copy, "package.json"));
      const vite = (await import(pathToFileURL(require.resolve("vite")).href)) as {
        createServer(config: object): Promise<ViteServer>;
      };
      const server = await vite.createServer({
        configFile: join(copy, `vite.config.${mode}.ts`),
        logLevel: "warn",
        server: { host: HOST, port: 0 },
      });
      try {
        await server.listen();
        const { port } = server.httpServer.address();
        recordPort(work, port);
        await use({ url: `http://${HOST}:${port}`, copy, watcher: server.watcher });
      } finally {
        await server.close();
      }
    },
    { scope: "worker", timeout: 120_000 },
  ],

  baseURL: async ({ devServer }, use) => {
    await use(devServer.url);
  },

  edit: async ({ devServer }, use) => {
    const editor = createEditor(devServer.copy, devServer.watcher);
    await use(editor.edit);
    await editor.restore();
  },
});
