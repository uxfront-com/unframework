// One Vite dev server per target (ADR-0088), built as a browser test project is: the target's
// `/toolchain` `vite("browser")` fragment after the unframework plugin. Each listens on a port of
// its own, so each frame has an origin of its own, and serves the frame page, the frame's module
// (the target's mount adapter, the frame runtime and a loader per entry) and, for a target with no
// client runtime, its render command.
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Toolchain } from "@unframework.dev/codegen";
import type { TargetName } from "@unframework.dev/compiler";
import { loadToolchain, toolchainClientFile } from "@unframework.dev/testing/config";
import type { InlineConfig, Plugin, ViteDevServer } from "vite";

import { FRAME_PATH, RENDER_PATH } from "./protocol.ts";

/** The host every preview server binds to: the preview is for this machine alone. */
export const PREVIEW_HOST = "127.0.0.1";

/** The frame module's URL, which the frame page loads. */
const FRAME_MODULE = "/__uf/frame.js";
const FRAME_MODULE_ID = "\0uf-preview:frame";

/** What a page outside Vitest gets for `vitest/browser`, which throws when it loads there. */
const NO_VITEST_ID = "\0uf-preview:vitest-browser";

/** The largest render request the render endpoint reads. */
const MAX_REQUEST_BYTES = 1_000_000;

/** One target's running server. */
export interface TargetServer {
  target: TargetName;
  /** `http://127.0.0.1:<port>`: the frame's origin. */
  origin: string;
  port: number;
  close(): Promise<void>;
}

/** What a target's server serves. */
export interface TargetServerOptions {
  root: string;
  target: TargetName;
  toolchainDir: string;
  /** Each entry's module (absolute), by id. */
  entries: Readonly<Record<string, string>>;
}

/** The frame runtime's file, wherever the package is installed. */
function frameFile(): string {
  return fileURLToPath(import.meta.resolve("@unframework.dev/visual/frame"));
}

/** The frame module: it starts the frame with the target's adapter and a loader per entry. */
export function frameModule(
  target: TargetName,
  client: string,
  frame: string,
  entries: Readonly<Record<string, string>>,
  serverRender: boolean,
): string {
  const loaders = Object.entries(entries)
    .map(([id, file]) => `    ${JSON.stringify(id)}: () => import(${JSON.stringify(file)}),`)
    .join("\n");
  return [
    `import { mount } from ${JSON.stringify(client)};`,
    `import { startFrame } from ${JSON.stringify(frame)};`,
    "",
    "startFrame({",
    `  target: ${JSON.stringify(target)},`,
    "  mount,",
    `  serverRender: ${serverRender},`,
    "  entries: {",
    loaders,
    "  },",
    "});",
    "",
  ].join("\n");
}

/** The frame page, before Vite's own transform adds its client and the plugins' preambles. */
export function framePage(target: TargetName): string {
  return [
    "<!doctype html>",
    '<html lang="en">',
    "  <head>",
    '    <meta charset="utf-8" />',
    `    <title>${target}: unframework preview</title>`,
    "  </head>",
    "  <body>",
    `    <div data-uf-preview-root data-target="${target}"></div>`,
    `    <script type="module" src="${FRAME_MODULE}"></script>`,
    "  </body>",
    "</html>",
    "",
  ].join("\n");
}

/** The preview's own plugin on a target's server. */
function previewPlugin(
  options: TargetServerOptions,
  toolchain: Toolchain,
  client: string,
  frame: string,
  render: ((server: ViteDevServer, request: unknown) => Promise<unknown>) | undefined,
): Plugin {
  return {
    name: "unframework:preview",
    enforce: "pre",
    resolveId(id) {
      if (id === FRAME_MODULE) return FRAME_MODULE_ID;
      // The Astro adapter imports Vitest's commands, which it reads only without the preview's
      // render transport: the page gets an empty module, since the real one throws on load.
      if (id === "vitest/browser") return NO_VITEST_ID;
      return null;
    },
    load(id) {
      if (id === FRAME_MODULE_ID) {
        return frameModule(options.target, client, frame, options.entries, render !== undefined);
      }
      if (id === NO_VITEST_ID) return "export const commands = {};\n";
      return null;
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = new URL(request.url ?? "/", "http://preview").pathname;
        if (path === FRAME_PATH && request.method === "GET") {
          void server
            .transformIndexHtml(request.url ?? FRAME_PATH, framePage(options.target))
            .then((html) => send(response, 200, "text/html", html), next);
          return;
        }
        if (path === RENDER_PATH && render) {
          void renderRequest(server, request, response, render, toolchain.name);
          return;
        }
        next();
      });
    },
  };
}

/** Runs a render request from the frame, and answers with its JSON or its error. */
async function renderRequest(
  server: ViteDevServer,
  request: IncomingMessage,
  response: ServerResponse,
  render: (server: ViteDevServer, request: unknown) => Promise<unknown>,
  target: string,
): Promise<void> {
  // The frame posts JSON from its own origin: a request another page could send without asking
  // (a form, a plain-text fetch) is refused.
  if (
    request.method !== "POST" ||
    !request.headers["content-type"]?.startsWith("application/json")
  ) {
    send(response, 405, "text/plain", `${RENDER_PATH} takes a JSON POST from the ${target} frame.`);
    return;
  }
  let body = "";
  try {
    for await (const chunk of request) {
      body += String(chunk);
      if (body.length > MAX_REQUEST_BYTES) {
        send(response, 413, "text/plain", "The render request is too large.");
        request.destroy();
        return;
      }
    }
    const result = await render(server, JSON.parse(body) as unknown);
    send(response, 200, "application/json", JSON.stringify(result));
  } catch (error) {
    send(response, 500, "text/plain", error instanceof Error ? error.message : String(error));
  }
}

function send(response: ServerResponse, status: number, type: string, body: string): void {
  if (response.headersSent) return;
  response.writeHead(status, { "content-type": `${type}; charset=utf-8` });
  response.end(body);
}

/** Starts a target's server, and resolves once it listens. */
export async function startTargetServer(options: TargetServerOptions): Promise<TargetServer> {
  const { root, target, toolchainDir } = options;
  const toolchain = await loadToolchain(target);
  const context = { toolchainDir, root };
  const fragment = await toolchain.vite("browser", context);
  const commands = toolchain.browserCommands?.(context) ?? {};
  const name = toolchain.renderCommandName;
  const command = name === undefined ? undefined : commands[name];
  if (name !== undefined && command === undefined) {
    throw new Error(
      `[uf:preview] The ${target} toolchain renders through "${name}", which its browserCommands lack.`,
    );
  }
  // A Vitest command's context: the one part of it a toolchain's command reads is the server
  // that serves the page (`project.browser.vite`), whose pipeline compiles what the render needs.
  const render =
    command &&
    ((server: ViteDevServer, request: unknown) =>
      Promise.resolve(
        (command as (context: unknown, request: unknown) => unknown)(
          { project: { browser: { vite: server } } },
          request,
        ),
      ));
  const { createServer, mergeConfig } = await import("vite");
  const { default: unframework } = await import("@unframework.dev/unplugin/vite");
  // The Vitest options a toolchain sets are no Vite server's.
  const { test: _test, ...vite } = fragment as typeof fragment & { test?: unknown };
  const base: InlineConfig = {
    root,
    configFile: false,
    envDir: false,
    appType: "custom",
    logLevel: "warn",
    clearScreen: false,
    // Each target's optimizer has its own cache, so seven never race over one directory.
    cacheDir: join(root, "node_modules", ".vite", `uf-preview-${target}`),
    plugins: [
      previewPlugin(options, toolchain, toolchainClientFile(toolchain), frameFile(), render),
      ...unframework({ target }),
    ],
    // Vite's own TypeScript transform, set so it stays on: outside Vitest, Analog's Angular plugin
    // turns it off unless the configuration sets it (`config.oxc ?? false`), and then nothing
    // strips the types of the adapter and the frame, which Analog compiles only under Vitest.
    oxc: {},
    optimizeDeps: {
      // No scan of the root's HTML: a project's expectations are HTML files, never pages.
      entries: [],
      // Installed, this package must not be pre-bundled, as the testing package is not
      // (ADR-0086): the frame runtime is served as it is.
      exclude: ["@unframework.dev/visual"],
    },
    server: { host: PREVIEW_HOST, port: 0, strictPort: false },
  };
  const server = await createServer(mergeConfig(base, vite));
  try {
    await server.listen();
  } catch (error) {
    await server.close();
    throw error;
  }
  const address = server.httpServer?.address();
  if (!address || typeof address === "string") {
    await server.close();
    throw new Error(`[uf:preview] The ${target} server listens on no TCP port.`);
  }
  const { port } = address;
  return {
    target,
    origin: `http://${PREVIEW_HOST}:${port}`,
    port,
    // Then what its commands started, such as Astro's render server, which holds no port.
    close: async () => {
      try {
        await server.close();
      } finally {
        await toolchain.close?.();
      }
    },
  };
}
