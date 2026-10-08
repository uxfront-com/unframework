// The Node half of the Astro browser project. The browser cannot run Astro, so the mount
// adapter asks the `ufAstroRender` browser command for the server HTML. The command renders
// through a dedicated Vite server built from Astro's own pipeline (`astroViteConfig`), with
// the Container API loaded through that server's SSR runner, so the container and the component
// share one copy of the Astro runtime (Astro's config inlines the `astro` package). A child that
// a component imports (`./Field.astro`, ADR-0053) is resolved and compiled by the browser
// project's own pipeline, as the component was (ADR-0057).
import { AsyncLocalStorage } from "node:async_hooks";
import { join } from "node:path";
import { formatWithOptions } from "node:util";

import type {
  CapturedConsoleMessage,
  ToolchainCommand,
  ToolchainContext,
} from "@unframework/codegen";
import type * as AstroContainerModule from "astro/container";
import type { experimental_AstroContainer as AstroContainer } from "astro/container";
import type { DevEnvironment, Plugin, RunnableDevEnvironment, ViteDevServer } from "vite";

import { astroViteConfig } from "./config.ts";
import {
  ASTRO_VIRTUAL_ID,
  astroComponentRef,
  isAstroComponentFactory,
  splitQuery,
} from "./protocol.ts";
import type { AstroRenderRequest, AstroRenderResult } from "./protocol.ts";
import { compiledAstroSource } from "./sources.ts";

interface RenderServer {
  server: ViteDevServer;
  ssr: RunnableDevEnvironment;
  container: AstroContainer;
  /** The source each virtual id was last loaded with, to notice a recompile. */
  served: Map<string, string>;
}

const servers = new Map<string, Promise<RenderServer>>();

/**
 * The browser project's pipeline, for the children a rendered component imports: the browser
 * itself imports only the component a spec mounts, so no browser project compiles its children
 * until the render server asks.
 */
export interface ChildModules {
  /** The virtual id an import of a compiled module names, as the browser project resolves it. */
  resolve(specifier: string, importer: string): Promise<string | undefined>;
  /** Compiles a virtual id in the browser project, which records its Astro source. */
  load(id: string): Promise<void>;
}

/** The children of the render running now: renders run one at a time. */
let children: ChildModules | undefined;

/** Astro's sub-requests (`?astro&type=style&index=0…`), served by Astro from its compile cache. */
const ASTRO_SUB_REQUEST = /[?&]astro(?:[&=]|$)/;

/** The `ufAstroRender` browser command for a project. */
export function createAstroRenderCommand(context: ToolchainContext): ToolchainCommand {
  return (browser: unknown, request: AstroRenderRequest) =>
    renderAstroComponent(context.root, request, browserChildModules(browser));
}

/**
 * The child modules of the browser project a command runs in (Vitest's command context,
 * `project.browser.vite`): its client environment resolves an import as a browser import would,
 * and loads and transforms a child as Vite's `this.load` does, through the unframework plugin
 * (with any canary) and the ref plugin that records the source. Like `this.load`, it enters the
 * child in the module graph first: Vite's import analysis refuses a module that has no entry
 * there. A child the golden guard failed is transformed into a module that throws, not into
 * its reference, and the render fails with the guard's message.
 */
function browserChildModules(browser: unknown): ChildModules | undefined {
  const vite = (browser as { project?: { browser?: { vite?: ViteDevServer } } } | undefined)
    ?.project?.browser?.vite;
  const client: DevEnvironment | undefined = vite?.environments.client;
  if (!client) return undefined;
  return {
    async resolve(specifier, importer) {
      return (await client.pluginContainer.resolveId(specifier, importer))?.id;
    },
    async load(id) {
      await client.moduleGraph.ensureEntryFromUrl(id);
      const loaded = await client.pluginContainer.load(id);
      const code = typeof loaded === "object" ? loaded?.code : loaded;
      if (code == null) return;
      const transformed = (await client.pluginContainer.transform(code, id)).code;
      if (transformed !== `export default ${JSON.stringify(astroComponentRef(id))};\n`) {
        const thrown = /^throw new Error\((".*")\);$/m.exec(transformed)?.[1];
        throw new Error(thrown ? (JSON.parse(thrown) as string) : transformed);
      }
    },
  };
}

// Renders run one at a time: the console capture patches the process-wide console, and a
// recompile invalidates modules another render could be importing.
let queue: Promise<unknown> = Promise.resolve();

/**
 * Renders a compiled component with its props, with the component's own `<style>` elements
 * first (the `?container` import), and returns what it logged. Rejects when the id was never
 * compiled by a browser project, or when the server, the import or the render fails.
 */
export function renderAstroComponent(
  root: string,
  request: AstroRenderRequest,
  childModules?: ChildModules,
): Promise<AstroRenderResult> {
  const run = async () => {
    children = childModules;
    try {
      return await render(root, request);
    } finally {
      children = undefined;
    }
  };
  const result = queue.then(run, run);
  queue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function render(root: string, { id, props }: AstroRenderRequest): Promise<AstroRenderResult> {
  if (!ASTRO_VIRTUAL_ID.test(id) || id.includes("?")) {
    throw new TypeError(`ufAstroRender: ${JSON.stringify(id)} is not an Astro output id.`);
  }
  const source = compiledAstroSource(id);
  if (source === undefined) {
    throw new Error(
      `ufAstroRender: ${id} was never compiled by a browser project; import the component in the spec and mount what the import yields.`,
    );
  }
  const server = await renderServer(root);
  // The component, or a child it imports, may have been compiled again since it was served.
  for (const [served, previous] of server.served) {
    if (compiledAstroSource(served) !== previous) invalidate(server.ssr, served);
  }

  const module: { default?: unknown } = await server.ssr.runner.import(`${id}?container`);
  const component = module.default;
  if (!isAstroComponentFactory(component)) {
    throw new TypeError(`ufAstroRender: ${id} does not export an Astro component by default.`);
  }
  const { value: html, messages } = await captureConsole(() =>
    server.container.renderComponent(component, { props }),
  );
  return { html, console: messages };
}

/** Drops a recompiled component from the server's module graph and the runner's cache. */
function invalidate(ssr: RunnableDevEnvironment, id: string): void {
  for (const node of ssr.moduleGraph.getModulesByFile(id) ?? []) {
    ssr.moduleGraph.invalidateModule(node);
  }
  for (const node of ssr.runner.evaluatedModules.getModulesByFile(id) ?? []) {
    ssr.runner.evaluatedModules.invalidateModule(node);
  }
}

function renderServer(root: string): Promise<RenderServer> {
  let server = servers.get(root);
  if (!server) {
    server = startRenderServer(root);
    servers.set(root, server);
  }
  return server;
}

async function startRenderServer(root: string): Promise<RenderServer> {
  const { createServer, isRunnableDevEnvironment } = await import("vite");
  const served = new Map<string, string>();
  const config = await astroViteConfig(root, { plugins: [compiledSourceLoader(served)] });
  const server = await createServer({
    ...config,
    configFile: false,
    // Its own cache, so it never races the test projects' optimizers over the same files.
    cacheDir: join(root, "node_modules", ".vite", "uf-astro-render"),
    // It never serves a browser, so no dependency scan (it would crawl every HTML file in the
    // root, the corpus's expectations included); Astro's own client includes still apply.
    optimizeDeps: { noDiscovery: true },
    // No HTTP server, HMR or file watching: a recompile is noticed by comparing sources. Under
    // Vitest, Astro also skips its dev request handling (`astro:server`), which nothing here uses.
    server: { ...config.server, middlewareMode: true, hmr: false, ws: false, watch: null },
  });
  try {
    const ssr = server.environments.ssr;
    if (!ssr || !isRunnableDevEnvironment(ssr)) {
      throw new Error("ufAstroRender: the render server's ssr environment cannot run modules.");
    }
    const astro: typeof AstroContainerModule = await ssr.runner.import("astro/container");
    const container = await astro.experimental_AstroContainer.create();
    return { server, ssr, container, served };
  } catch (error) {
    // A server that cannot render is never handed out, so it is closed here.
    await server.close();
    throw error;
  }
}

/**
 * Serves each virtual id the source the browser project compiled, in place of the unframework
 * plugin: the render server must not compile again, or it could render different code. A
 * relative import of a served module names a child: the browser project resolves it, and
 * compiles it unless it has already.
 */
function compiledSourceLoader(served: Map<string, string>): Plugin {
  return {
    name: "unframework:astro-render-source",
    enforce: "pre",
    async resolveId(id, importer) {
      if (ASTRO_VIRTUAL_ID.test(id)) return id;
      const [parent] = splitQuery(importer ?? "");
      if (!children || !/^\.\.?\//.test(id) || !ASTRO_VIRTUAL_ID.test(parent)) return null;
      const child = await children.resolve(id, parent);
      if (child === undefined || !ASTRO_VIRTUAL_ID.test(child)) return null;
      const [path] = splitQuery(child);
      if (compiledAstroSource(path) === undefined) await children.load(path);
      return path;
    },
    load: {
      filter: { id: ASTRO_VIRTUAL_ID },
      handler(id) {
        const [path, query] = splitQuery(id);
        if (ASTRO_SUB_REQUEST.test(query)) return null;
        const source = compiledAstroSource(path);
        if (source === undefined) {
          throw new Error(`ufAstroRender: no compiled source for ${path}.`);
        }
        served.set(path, source);
        return source;
      },
    },
  };
}

/** Closes every render server; Vitest calls it when it closes. */
export async function closeAstroRenderServers(): Promise<void> {
  const pending = [...servers.values()];
  servers.clear();
  // A server that failed to start has already failed the render that started it.
  const started = await Promise.allSettled(pending);
  await Promise.all(
    started.flatMap((outcome) =>
      outcome.status === "fulfilled" ? [outcome.value.server.close()] : [],
    ),
  );
}

const renders = new AsyncLocalStorage<CapturedConsoleMessage[]>();

/**
 * Collects the `console.warn` and `console.error` calls a render makes (layer L13). The console
 * is process-wide and other projects share the process, so a call counts only when it comes from
 * the render's own async context; any other call reaches the real console.
 */
async function captureConsole<T>(
  run: () => Promise<T>,
): Promise<{ value: T; messages: CapturedConsoleMessage[] }> {
  const messages: CapturedConsoleMessage[] = [];
  const { warn, error } = console;
  console.warn = capturing("warn", warn);
  console.error = capturing("error", error);
  try {
    return { value: await renders.run(messages, run), messages };
  } finally {
    console.warn = warn;
    console.error = error;
  }
}

function capturing(level: CapturedConsoleMessage["level"], original: Console["warn"]) {
  return (...args: unknown[]): void => {
    const sink = renders.getStore();
    if (sink) sink.push({ level, message: formatWithOptions({ colors: false }, ...args) });
    else original(...args);
  };
}
