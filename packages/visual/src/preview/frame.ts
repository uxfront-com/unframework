import { layoutStyle } from "./layout.ts";
// The preview's frame (ADR-0088): the page each target's server serves in the shell's iframe. It
// mounts the entry the shell selects with the target's own mount adapter, rerenders it in place
// when only the props change, and answers each render. It takes messages only from its parent
// window, at the origin the shell gave in its URL: in development every frame has an origin of its
// own, and in a static preview every frame shares the shell's (ADR-0111), so a static frame
// answers only a shell at its own origin: no other page can drive it on the site's origin.
//
// With no shell and an example in its URL, the frame is standalone (ADR-0112): it renders that
// example once, with no props, adds no message listener and posts no message, so any page may
// frame it and none can drive it.
import {
  EXAMPLE_KEY_PREFIX,
  EXAMPLE_PARAM,
  PREVIEW_MESSAGE,
  RENDER_PATH,
  STATIC_RENDER_MESSAGE,
} from "./protocol.ts";
import type { FrameMessage, FrameOptions, RenderMessage, StaticRender } from "./protocol.ts";

type Mounted = Awaited<ReturnType<FrameOptions["mount"]>>;

/** What a frame shows when nothing in its URL tells it what to render. */
const FRAME_NOTICE = "This page is a frame of unframework preview: open the preview's URL.";

/**
 * Starts the frame. Driven by the shell (`?shell=`), it says it is ready, then renders what the
 * shell asks, one message at a time. Standalone (`?example=` and no `shell`), it renders the
 * example once and shows why when it can't.
 */
export function startFrame(options: FrameOptions): void {
  const params = new URLSearchParams(location.search);
  const root = document.querySelector<HTMLElement>("[data-uf-preview-root]");
  const example = params.get(EXAMPLE_PARAM);
  // Any `shell` parameter, even an empty one, keeps the shell's path as it was before ADR-0112.
  if (root && !params.has("shell") && example !== null) {
    void standalone(options, root, example);
    return;
  }
  const shell = params.get("shell");
  if (!shell || !root || (options.staticPreview && shell !== location.origin)) {
    document.body.textContent = FRAME_NOTICE;
    return;
  }
  const render = renderer(options, root);
  const send = (message: FrameMessage) => window.parent.postMessage(message, shell);
  // Renders run in order: a mount must finish before the rerender that follows it.
  let queue: Promise<void> = Promise.resolve();

  const answer = async (message: RenderMessage) => {
    try {
      await render(message.entry, message.props);
      send({ type: PREVIEW_MESSAGE, kind: "rendered", target: options.target, seq: message.seq });
    } catch (error) {
      send({
        type: PREVIEW_MESSAGE,
        kind: "failed",
        target: options.target,
        seq: message.seq,
        message: errorMessage(error),
      });
    }
  };

  window.addEventListener("message", (event: MessageEvent<unknown>) => {
    if (event.source !== window.parent || event.origin !== shell) return;
    const message = event.data as Partial<RenderMessage> | null;
    if (message?.type !== PREVIEW_MESSAGE || message.kind !== "render") return;
    if (typeof message.entry !== "string" || typeof message.seq !== "number") return;
    const props = message.props && typeof message.props === "object" ? message.props : {};
    queue = queue.then(() => answer({ ...(message as RenderMessage), props }));
  });
  send({ type: PREVIEW_MESSAGE, kind: "ready", target: options.target });
}

/**
 * The standalone frame (ADR-0112): the example named in its URL, rendered once with the props an
 * example takes, none, through the same `render` the shell's frames use. Its failure, an unknown
 * id included, replaces the page with the message as text, so an embed is never blank.
 */
async function standalone(options: FrameOptions, root: HTMLElement, id: string): Promise<void> {
  const entry = `${EXAMPLE_KEY_PREFIX}${id}`;
  try {
    if (!Object.hasOwn(options.entries, entry)) {
      throw new Error(`This preview has no example ${JSON.stringify(id)}.`);
    }
    await renderer(options, root)(entry, {});
  } catch (error) {
    document.body.textContent = errorMessage(error);
  }
}

/**
 * The frame's render: it mounts an entry with props in a fresh container, or rerenders the entry
 * it holds in place, and throws on an entry it lacks or a mount that fails.
 */
function renderer(
  options: FrameOptions,
  root: HTMLElement,
): (entry: string, props: Record<string, unknown>) => Promise<void> {
  let container: HTMLElement = root;
  let current: { entry: string; mounted: Mounted } | undefined;
  return async (entry, props) => {
    if (current?.entry === entry) {
      await current.mounted.rerender(props);
      return;
    }
    const previous = current;
    current = undefined;
    await previous?.mounted.unmount();
    // A fresh container for each mount: a framework may mark the one it rendered into, as
    // Qwik's `q:container` does, and refuse to render there again.
    const fresh = document.createElement("div");
    fresh.dataset.ufPreviewRoot = "";
    fresh.dataset.target = options.target;
    // The entry's layout goes on its own container only (ADR-0114), so nothing of the previous
    // entry's carries over, and the example's own elements keep their styles.
    const layouts = options.layouts ?? {};
    const layout = Object.hasOwn(layouts, entry) ? layouts[entry] : undefined;
    for (const [property, value] of Object.entries(layoutStyle(layout))) {
      fresh.style.setProperty(property, value);
    }
    container.replaceWith(fresh);
    container = fresh;
    const load = Object.hasOwn(options.entries, entry) ? options.entries[entry] : undefined;
    if (!load) throw new Error(`The preview has no entry ${JSON.stringify(entry)}.`);
    const component = (await load()).default;
    if (component === undefined) {
      throw new Error(`${entry} has no default export to mount.`);
    }
    const renderCommand = options.staticRenders
      ? staticRender(options.staticRenders[entry])
      : options.serverRender
        ? serverRender
        : undefined;
    const mounted = await options.mount(component, container, {
      props,
      ...(renderCommand ? { renderCommand } : {}),
    });
    current = { entry, mounted };
  };
}

/** An error's message, as the shell's caption and a standalone frame show it. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** The server render of a target with no client runtime, through this frame's own server. */
async function serverRender(request: {
  id: string;
  props: Record<string, unknown>;
}): Promise<{ html: string; console: { level: "warn" | "error"; message: string }[] }> {
  const response = await fetch(RENDER_PATH, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as Awaited<ReturnType<typeof serverRender>>;
}

/**
 * The render transport of a static preview (ADR-0111): the render the build made for the entry,
 * read beside the frame page. It answers only the props the build rendered with: a static site
 * runs no server, so any other props fail with a message that says so.
 */
function staticRender(
  file: string | undefined,
): (request: { props: Record<string, unknown> }) => Promise<{ html: string; console: [] }> {
  let read: Promise<StaticRender> | undefined;
  return async ({ props }) => {
    if (file === undefined) throw new Error(STATIC_RENDER_MESSAGE);
    read ??= fetch(file).then(async (response) => {
      if (!response.ok) throw new Error(`${file}: ${response.status} ${response.statusText}`);
      return (await response.json()) as StaticRender;
    });
    const rendered = await read.catch((error: unknown) => {
      read = undefined;
      throw error;
    });
    if (!sameProps(rendered.props, props)) throw new Error(STATIC_RENDER_MESSAGE);
    if ("error" in rendered) throw new Error(rendered.error);
    return { html: rendered.html, console: [] };
  };
}

/** Whether two sets of props hold the same keys with the same values, as JSON gives them. */
export function sameProps(
  a: Readonly<Record<string, unknown>>,
  b: Readonly<Record<string, unknown>>,
): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every(
    (key) => Object.hasOwn(b, key) && JSON.stringify(a[key]) === JSON.stringify(b[key]),
  );
}
