// One Vite dev server per target (ADR-0088), built as a browser test project is: the target's
// `/toolchain` `vite("browser")` fragment after the unframework plugin. Each listens on a port of
// its own, so each frame has an origin of its own, and serves the frame page, the frame's module
// (the target's mount adapter, the frame runtime and a loader per entry) and, for a target with no
// client runtime, its render command. A static preview (ADR-0111) builds the same configuration
// with Vite's `build`, the frame page as its input, into a directory of its own per target.
import { existsSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import type { Toolchain, ToolchainContext } from "@unframework.dev/codegen";
import type { TargetName } from "@unframework.dev/compiler";
import {
  loadToolchain,
  passThroughDeclarations,
  projectPlugins,
  toolchainClientFile,
  withProjectVite,
} from "@unframework.dev/testing/config";
import type { ProjectVite } from "@unframework.dev/testing/config";
import type { InlineConfig, Plugin, ViteDevServer } from "vite";

import type { ExampleControlGroup, SourceTransform } from "./instrument.ts";
import { FRAME_PATH, RENDER_PATH, STATIC_FRAME_FILE } from "./protocol.ts";
import type { PreviewLayout } from "./protocol.ts";

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
  /**
   * The project's Vite config (`vite` in `unframework.config.ts`, ADR-0104), which the server
   * calls with its target and `mode: "preview"`: its plugins go before the unframework plugin,
   * and its other keys merge into the server's config. None by default.
   */
  vite?: ProjectVite;
  /**
   * What the unframework plugin compiles in place of a file's text (its `transformSource`): the
   * preview binds its controls to an example's components this way (ADR-0113). None by default.
   */
  transformSource?: SourceTransform;
  /** The layout of each entry that sets one, by key (ADR-0114): the frame centres the others. */
  layouts?: Readonly<Record<string, PreviewLayout>>;
  /** The control groups of each example that has any, by key, for an embed's controls (ADR-0116). */
  controls?: Readonly<Record<string, ExampleControlGroup[]>>;
}

/** The frame runtime's file, wherever the package is installed. */
function frameFile(): string {
  return fileURLToPath(import.meta.resolve("@unframework.dev/visual/frame"));
}

/**
 * The renders a static preview made at build time for a target with no client runtime: for each
 * entry, the serialisable value its module gives as its default export, which the frame mounts in
 * place of importing the module, and the URL of its render, relative to the frame page.
 */
export type StaticRenders = Readonly<Record<string, { component: unknown; file: string }>>;

/**
 * The frame module: it starts the frame with the target's adapter and a loader per entry. With
 * static renders, an entry's loader gives its recorded default export, and nothing imports the
 * entry's module, which only a server could render.
 */
export function frameModule(
  target: TargetName,
  client: string,
  frame: string,
  entries: Readonly<Record<string, string>>,
  serverRender: boolean,
  staticRenders?: StaticRenders,
  staticPreview = false,
  layouts: Readonly<Record<string, PreviewLayout>> = {},
  controls: Readonly<Record<string, ExampleControlGroup[]>> = {},
): string {
  const loaders = Object.entries(entries)
    .map(([id, file]) => {
      const recorded = staticRenders?.[id];
      const load = recorded
        ? `Promise.resolve({ default: ${JSON.stringify(recorded.component)} })`
        : `import(${JSON.stringify(file)})`;
      return `    ${JSON.stringify(id)}: () => ${load},`;
    })
    .join("\n");
  const renders = staticRenders
    ? Object.entries(staticRenders).map(
        ([id, { file }]) => `    ${JSON.stringify(id)}: ${JSON.stringify(file)},`,
      )
    : undefined;
  return [
    `import { mount } from ${JSON.stringify(client)};`,
    `import { startFrame } from ${JSON.stringify(frame)};`,
    "",
    "startFrame({",
    `  target: ${JSON.stringify(target)},`,
    "  mount,",
    `  serverRender: ${serverRender},`,
    ...(staticPreview ? ["  staticPreview: true,"] : []),
    ...(renders ? ["  staticRenders: {", ...renders, "  },"] : []),
    ...(Object.keys(layouts).length ? [`  layouts: ${JSON.stringify(layouts)},`] : []),
    ...(Object.keys(controls).length ? [`  controls: ${JSON.stringify(controls)},`] : []),
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
    // The frame fills its iframe, so the container's layout can centre an example in it (ADR-0114).
    "    <style>html, body { margin: 0; height: 100%; }</style>",
    "  </head>",
    "  <body>",
    `    <div data-uf-preview-root data-target="${target}"></div>`,
    `    <script type="module" src="${FRAME_MODULE}"></script>`,
    "  </body>",
    "</html>",
    "",
  ].join("\n");
}

/** The frame page's id in a build: the input Vite writes as `<target>/frame.html`. */
function framePageId(root: string): string {
  return join(root, STATIC_FRAME_FILE);
}

/** The preview's own plugin on a target's server, or in its build. */
function previewPlugin(
  options: TargetServerOptions,
  toolchain: Toolchain,
  client: string,
  frame: string,
  render: TargetRender | undefined,
  staticRenders: StaticRenders | undefined,
): Plugin {
  const page = framePageId(options.root);
  // A build writes a static preview's frame, which takes messages only from its own origin.
  let building = false;
  return {
    name: "unframework:preview",
    enforce: "pre",
    configResolved(config) {
      building = config.command === "build";
    },
    resolveId(id) {
      if (id === page) return page;
      if (id === FRAME_MODULE) return FRAME_MODULE_ID;
      // The Astro adapter imports Vitest's commands, which it reads only without the preview's
      // render transport: the page gets an empty module, since the real one throws on load.
      if (id === "vitest/browser") return NO_VITEST_ID;
      return null;
    },
    load(id) {
      if (id === page) return framePage(options.target);
      if (id === FRAME_MODULE_ID) {
        return frameModule(
          options.target,
          client,
          frame,
          options.entries,
          render !== undefined,
          staticRenders,
          building,
          options.layouts,
          options.controls,
        );
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
    // A build's base is `/`, for a framework plugin that refuses a relative one (Qwik's), and its
    // modules and sheets name each other by relative URLs (`renderBuiltUrl`). The tags Vite adds
    // to the frame page are the one place left with the base: made relative too, so the site
    // serves at any path (ADR-0111). A dev server's page keeps its own.
    transformIndexHtml: {
      order: "post",
      handler: (html, context) =>
        context.bundle ? html.replace(/\b(src|href)="\/(?!\/)/g, '$1="./') : html,
    },
    // A development build names its sources by path, as React's `jsxDEV`, Vue's `__file` and
    // Qwik's QRLs do: relative to the root, or to its repository for a file outside it, in a
    // static preview, which carries no path of the machine that built it.
    renderChunk: (code) => withoutRoot(code, options.root),
  };
}

/** A target's render command, run with the server whose pipeline compiles what it renders. */
export type TargetRender = (server: ViteDevServer, request: unknown) => Promise<unknown>;

/** Runs a render request from the frame, and answers with its JSON or its error. */
async function renderRequest(
  server: ViteDevServer,
  request: IncomingMessage,
  response: ServerResponse,
  render: TargetRender,
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

/**
 * A target's server configuration, as Vite's `createServer` takes it, its toolchain, whose
 * `close` stops what its commands start, and its render command, for a target with no client
 * runtime. Building it starts nothing. With static renders, the frame mounts those in place of
 * the entries' modules (a static preview's build, ADR-0111).
 */
export async function targetServerConfig(
  options: TargetServerOptions,
  staticRenders?: StaticRenders,
): Promise<{ config: InlineConfig; toolchain: Toolchain; render?: TargetRender }> {
  const { root, target } = options;
  const toolchain = await loadToolchain(target);
  // Angular's compiler takes the pass-through modules through their declarations, and a render
  // server of the toolchain's own (Astro's) loads the project's plugins too (ADR-0104).
  const project = { target, mode: "preview" } as const;
  const context: ToolchainContext = {
    toolchainDir: options.toolchainDir,
    root,
    declarations: passThroughDeclarations(root),
    plugins: projectPlugins(options.vite, project),
  };
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
  const { mergeConfig } = await import("vite");
  const { default: unframework } = await import("@unframework.dev/unplugin/vite");
  // The Vitest options a toolchain sets are no Vite server's.
  const { test: _test, ...own } = fragment as typeof fragment & { test?: unknown };
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
      previewPlugin(
        options,
        toolchain,
        toolchainClientFile(toolchain),
        frameFile(),
        render,
        staticRenders,
      ),
      ...unframework({
        target,
        ...(options.transformSource ? { transformSource: options.transformSource } : {}),
      }),
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
  // The project's config goes in last, as in a browser test project: its plugins before the
  // unframework plugin, the rest merged after the toolchain's fragment (ADR-0064, ADR-0104).
  const config = await withProjectVite(mergeConfig(base, own), options.vite, project);
  return { config, toolchain, ...(render ? { render } : {}) };
}

/** Starts a target's server, and resolves once it listens. */
export async function startTargetServer(options: TargetServerOptions): Promise<TargetServer> {
  const { target } = options;
  const { config, toolchain } = await targetServerConfig(options);
  const { createServer } = await import("vite");
  const server = await createServer(config);
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

/**
 * Builds a target's frame into `outDir` with Vite's `build`, on its server's configuration
 * (ADR-0111): the frame page as the input, written as `frame.html`, with its modules and sheets
 * beside it under `assets/`, every URL among them relative. The toolchain is closed after.
 */
export async function buildTarget(
  options: TargetServerOptions,
  outDir: string,
  staticRenders?: StaticRenders,
): Promise<void> {
  const { config, toolchain } = await targetServerConfig(options, staticRenders);
  try {
    const { build, mergeConfig } = await import("vite");
    const { server: _server, ...own } = config;
    await build(
      mergeConfig(own, {
        // A development build, as the dev server serves: a mount adapter may need the framework's
        // development build, as React's needs its `act`. `buildPreview` sets `NODE_ENV` to match.
        mode: "development",
        base: "/",
        experimental: { renderBuiltUrl: () => ({ relative: true }) },
        build: {
          outDir,
          emptyOutDir: false,
          // A static preview is for looking at: no maps, which would carry the sources' paths.
          sourcemap: false,
          rolldownOptions: { input: framePageId(options.root) },
        },
      } satisfies InlineConfig),
    );
  } finally {
    await toolchain.close?.();
  }
}

/**
 * Renders each entry of a target with no client runtime with its initial props, through a server
 * in middleware mode that holds no port, and closes it and the toolchain after (ADR-0111). Each
 * entry's module gives a serialisable value as its default export, which the frame mounts and the
 * render names: its JSON, as the module's whole code. Gives each entry's value, with the paths in
 * it made relative to the root, so the site carries none of this machine's, and its render's HTML,
 * or the message of a render that failed.
 */
export async function renderTargetEntries(
  options: TargetServerOptions,
  props: Readonly<Record<string, Record<string, unknown>>>,
): Promise<
  Record<string, { component: unknown; html: string } | { component: unknown; error: string }>
> {
  const { config, toolchain, render } = await targetServerConfig(options);
  if (!render) {
    await toolchain.close?.();
    throw new Error(`[uf:preview] The ${options.target} toolchain has no render command.`);
  }
  const { createServer } = await import("vite");
  let server: ViteDevServer | undefined;
  try {
    server = await createServer({
      ...config,
      server: { middlewareMode: true, hmr: false, ws: false },
    });
    const client = server.environments.client;
    const rendered: Awaited<ReturnType<typeof renderTargetEntries>> = {};
    for (const [entry, file] of Object.entries(options.entries)) {
      const resolved = (await client.pluginContainer.resolveId(file))?.id ?? file;
      const code = (await client.transformRequest(resolved))?.code ?? "";
      const component = defaultExport(code);
      if (!isReference(component)) {
        throw new Error(
          `[uf:preview] ${relative(options.root, file)} gives the ${options.target} frame no serialisable reference to render.`,
        );
      }
      const relativeComponent = { ...component, id: rootRelative(options.root, component.id) };
      // A render that fails is the frame's to show, as on a dev server: the build goes on.
      try {
        const result = await render(server, { id: component.id, props: props[entry] ?? {} });
        const html = (result as { html?: unknown } | null)?.html;
        if (typeof html !== "string") {
          throw new TypeError(`The ${options.target} render command gave no HTML.`);
        }
        rendered[entry] = { component: relativeComponent, html: withoutRoot(html, options.root) };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        rendered[entry] = {
          component: relativeComponent,
          error: withoutRoot(message, options.root),
        };
      }
    }
    return rendered;
  } finally {
    try {
      await server?.close();
    } finally {
      await toolchain.close?.();
    }
  }
}

/** The value of a module whose whole code is `export default <JSON>;`, or `undefined`. */
function defaultExport(code: string): unknown {
  const match = /^export default (.*);\s*$/s.exec(code);
  if (!match) return undefined;
  try {
    return JSON.parse(match[1]!) as unknown;
  } catch {
    return undefined;
  }
}

function isReference(value: unknown): value is { id: string } & Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { id?: unknown }).id === "string"
  );
}

/**
 * Text with every absolute path under the root made relative to it, and then every one under the
 * root's repository (the nearest directory above it with `.git`) relative to that, with forward
 * slashes.
 */
export function withoutRoot(text: string, root: string): string {
  let result = text;
  for (const directory of [root, repositoryOf(root)]) {
    if (directory === undefined) continue;
    const prefix = `${directory.split(sep).join("/").replace(/\/$/, "")}/`;
    if (result.includes(prefix)) result = result.split(prefix).join("");
  }
  return result;
}

/** The nearest directory above `root`, or `root` itself, that holds `.git`. */
function repositoryOf(root: string): string | undefined {
  for (let directory = root; ; directory = dirname(directory)) {
    if (existsSync(join(directory, ".git"))) return directory;
    if (dirname(directory) === directory) return undefined;
  }
}

/** A path under the root, relative to it with forward slashes; any other is left as it is. */
function rootRelative(root: string, path: string): string {
  const rel = relative(root, path);
  return rel.startsWith("..") || rel === path ? path : rel.split(sep).join("/");
}
