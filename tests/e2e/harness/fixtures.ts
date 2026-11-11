import { existsSync } from "node:fs";
import { join } from "node:path";

import { test as base } from "@playwright/test";

import { workDir } from "./apps.ts";
import { startDevServer } from "./dev-servers.ts";
import { createEditor, type Edit, type Watcher } from "./edit.ts";
import { HOST, recordPort } from "./ports.ts";

export { expect } from "@playwright/test";

interface DevServer {
  url: string;
  copy: string;
  watcher: Watcher;
  editTimeout: number | undefined;
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
      const server = await startDevServer(app, mode, copy);
      try {
        recordPort(work, server.port);
        await use({
          url: `http://${HOST}:${server.port}`,
          copy,
          watcher: server.watcher,
          editTimeout: server.editTimeout,
        });
      } finally {
        await server.stop();
      }
    },
    { scope: "worker", timeout: 120_000 },
  ],

  baseURL: async ({ devServer }, use) => {
    await use(devServer.url);
  },

  edit: async ({ devServer }, use) => {
    const editor = createEditor(devServer.copy, devServer.watcher, devServer.editTimeout);
    await use(editor.edit);
    await editor.restore();
  },
});
