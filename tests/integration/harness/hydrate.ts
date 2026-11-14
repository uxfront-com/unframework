// The Node half of the hydrate projects (L12, ADR-0095), which only the harness runs: `ufHydrationRender` renders the case's
// main component on the server, with the scenario's props, for the page to hydrate. It renders in
// the SSR environment of the calling project's own browser server, so one plugin pipeline compiles
// both sides (the unplugin, its golden guard and any canary), and Qwik's segment URLs resolve
// against the server that serves the page. The environment runs through a plain Vite module
// runner: Vitest's own evaluator on it externalises `node_modules`, which loads a second build of
// a framework beside the one the compiled component imports (Qwik refuses that, Q30).
import { AsyncLocalStorage } from "node:async_hooks";
import { isAbsolute, relative, sep } from "node:path";
import { formatWithOptions } from "node:util";

import type { CapturedConsoleMessage, HydrationRenderer } from "@unframework.dev/codegen";
import { caseMainSource, compiledEvents, projectHarness } from "@unframework.dev/testing/node";
import type {
  CommandProject,
  HydrationRenderRequest,
  HydrationRenderResult,
} from "@unframework.dev/testing/node";
import { createServerModuleRunner } from "vite";
import type { DevEnvironment, ViteDevServer } from "vite";
import type { ModuleRunner } from "vite/module-runner";
// Vitest's `Plugin` is Vite's, with the `configureVitest` hook declared.
import type { Plugin } from "vitest/config";

/** What the command reads from Vitest's command context: the project and its browser server. */
export interface HydrationCommandContext extends CommandProject {
  project: CommandProject["project"] & { browser?: { vite?: ViteDevServer } };
}

/** One module runner per SSR environment: its cache is the environment's evaluated modules. */
const runners = new Map<DevEnvironment, ModuleRunner>();

/**
 * The console messages of the render that logs them: renders run concurrently, one per page, and
 * each collects only what its own async work logs. Anything else reaches the console as before.
 */
const renders = new AsyncLocalStorage<CapturedConsoleMessage[]>();

/**
 * `ufHydrationRender`: the server HTML of the calling case's main component with `props`, as the
 * target's `renderForHydration` gives it (every marker and script its client needs), what the
 * render logged, and the URL the page imports that component from, so the page can check that
 * the spec mounts that component and nothing else.
 */
export async function ufHydrationRender(
  context: HydrationCommandContext,
  request: HydrationRenderRequest,
): Promise<HydrationRenderResult> {
  try {
    return await render(context, request);
  } catch (error) {
    // The page gets the message alone: the stack says where in Node the render failed.
    const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
    throw new Error(`ufHydrationRender: ${request.case}: ${detail}`, { cause: error });
  }
}

async function render(
  context: HydrationCommandContext,
  request: HydrationRenderRequest,
): Promise<HydrationRenderResult> {
  const { harness, target } = projectHarness(context);
  const { ufServer: server } = context.project.getProvidedContext() as { ufServer?: string };
  if (!server) {
    throw new Error(
      `[uf] Project "${context.project.name}" does not provide "ufServer": ufHydrationRender runs only in hydrate projects.`,
    );
  }
  const vite = context.project.browser?.vite;
  const ssr = vite?.environments.ssr;
  if (!vite || !ssr) {
    throw new Error(
      `[uf] Project "${context.project.name}" has no browser server with an SSR environment to render in.`,
    );
  }
  const source = caseMainSource(harness, request.case);
  const runner = runnerOf(ssr);
  const [renderer, module] = await Promise.all([
    runner.import(server) as Promise<{ renderForHydration?: HydrationRenderer }>,
    runner.import(source) as Promise<{ default?: unknown }>,
  ]);
  if (typeof renderer.renderForHydration !== "function") {
    throw new Error(
      `[uf] ${server} exports no renderForHydration: a toolchain with a hydrate adapter renders its server HTML through it (ADR-0095).`,
    );
  }
  const messages: CapturedConsoleMessage[] = [];
  installConsoleCapture();
  // The events the component declares, as the page listens to them: a renderer whose client
  // cannot take a function from the server (Qwik's QRLs) renders a listener for each by name.
  const events = compiledEvents(source, target);
  const on = Object.fromEntries(events.map(({ name }) => [name, () => {}]));
  const html = await renders.run(messages, () =>
    renderer.renderForHydration!(module.default, { props: { ...request.props }, on, events }),
  );
  return { html, console: messages, module: await clientUrl(vite, source) };
}

/**
 * The URL the page imported a source from: the client environment resolves an import of it as
 * the spec's own import did (to a target's virtual module, such as Vue's `.uf.tsx.vue`), and its
 * module graph has the URL it served that module at. A source the page never imported has its
 * file's URL, which no spec's import names, so the identity check then fails.
 */
async function clientUrl(vite: ViteDevServer, source: string): Promise<string> {
  const client = vite.environments.client;
  const resolved = await client?.pluginContainer.resolveId(source, undefined);
  const served = resolved ? client?.moduleGraph.getModuleById(resolved.id)?.url : undefined;
  return served ?? moduleUrl(vite.config.root, source);
}

function runnerOf(ssr: DevEnvironment): ModuleRunner {
  let runner = runners.get(ssr);
  if (!runner) {
    runner = createServerModuleRunner(ssr, { hmr: false });
    runners.set(ssr, runner);
  }
  return runner;
}

/** Closes every module runner the render command started, which would keep the process alive. */
export async function closeHydrationRunners(): Promise<void> {
  const open = [...runners.values()];
  runners.clear();
  await Promise.all(open.map((runner) => runner.close()));
}

/** Closes the hydrate projects' module runners when Vitest closes, as Astro's plugin does. */
export function hydrationRunners(): Plugin {
  return {
    name: "uf-harness:hydration-runners",
    configureVitest({ vitest }) {
      vitest.onClose(closeHydrationRunners);
    },
  };
}

/** The URL a page imports a source from: under the server's root, or through `/@fs/`. */
export function moduleUrl(root: string, source: string): string {
  const path = relative(root, source);
  if (path && !path.startsWith("..") && !isAbsolute(path)) return `/${path.split(sep).join("/")}`;
  return `/@fs/${source.split(sep).join("/").replace(/^\/+/, "")}`;
}

let installed = false;

/** Routes `console.warn` and `console.error` to the render that logs them, once per process. */
function installConsoleCapture(): void {
  if (installed) return;
  installed = true;
  console.warn = capturing("warn", console.warn.bind(console));
  console.error = capturing("error", console.error.bind(console));
}

function capturing(level: CapturedConsoleMessage["level"], original: Console["warn"]) {
  return (...args: unknown[]): void => {
    const sink = renders.getStore();
    if (sink) sink.push({ level, message: formatWithOptions({ colors: false }, ...args) });
    else original(...args);
  };
}
