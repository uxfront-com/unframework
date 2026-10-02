// Temporary projects and real Vite 8 dev servers for the plugin tests. The framework plugins are
// not dependencies of this package, so the tests drive the hooks through the plugin container,
// and a stand-in for plugin-vue completes the pipeline where a test needs Vite's own passes.
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { createLogger, createServer } from "vite";
import type { DevEnvironment, Plugin, PluginOption, ViteDevServer } from "vite";

import type { UnframeworkApi } from "../src/index.ts";

export const HELLO =
  'export default function Hello() {\n  return <p class="greeting">Hello, world!</p>;\n}\n';

/** A temporary project directory. */
export interface Project {
  /** The real path (macOS links /var to /private/var, and Vite resolves to real paths). */
  root: string;
  /** Writes a file and returns its absolute path. */
  write(path: string, contents: string): string;
  remove(): void;
}

export function createProject(files: Record<string, string> = {}): Project {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "uf-unplugin-")));
  const write = (path: string, contents: string) => {
    const file = join(root, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, contents);
    return file;
  };
  for (const [path, contents] of Object.entries(files)) write(path, contents);
  return { root, write, remove: () => rmSync(root, { recursive: true, force: true }) };
}

/** A dev server with no watcher, HMR or dependency discovery, and its captured warnings. */
export interface TestServer {
  server: ViteDevServer;
  client: DevEnvironment;
  warnings: string[];
  close(): Promise<void>;
}

export async function startServer(root: string, plugins: PluginOption[]): Promise<TestServer> {
  const warnings: string[] = [];
  const logger = createLogger("warn", { allowClearScreen: false });
  const warn = (message: string) => void warnings.push(message);
  logger.warn = warn;
  logger.warnOnce = warn;
  const server = await createServer({
    root,
    configFile: false,
    appType: "custom",
    clearScreen: false,
    customLogger: logger,
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins,
  });
  return {
    server,
    client: server.environments.client,
    warnings,
    close: () => server.close(),
  };
}

/** The `api` of the unframework plugin, found by name as other plugins find it. */
export function apiOf(server: ViteDevServer): UnframeworkApi {
  const plugin = server.config.plugins.find(
    (candidate): candidate is Plugin<UnframeworkApi> => candidate.name === "unframework",
  );
  if (!plugin?.api) throw new Error("the unframework plugin is not installed");
  return plugin.api;
}

/** Stands in for plugin-vue: turns a `.vue` module into JS that exports its source. */
export const fakeVue: Plugin = {
  name: "fake-vue",
  transform: {
    filter: { id: /\.vue$/ },
    handler: (code) => ({ code: `export default ${JSON.stringify(code)};\n`, map: null }),
  },
};

/** The code a load result holds. */
export function codeOf(result: unknown): string {
  if (typeof result === "string") return result;
  if (result && typeof result === "object" && "code" in result && typeof result.code === "string") {
    return result.code;
  }
  throw new Error(`no code in the load result ${JSON.stringify(result)}`);
}
