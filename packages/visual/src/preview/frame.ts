// The preview's frame (ADR-0088): the page each target's server serves in the shell's iframe. It
// mounts the entry the shell selects with the target's own mount adapter, rerenders it in place
// when only the props change, and answers each render. It takes messages only from its parent
// window, at the origin the shell gave in its URL: in development every frame has an origin of its
// own, and in a static preview every frame shares the shell's (ADR-0111), so a static frame
// answers only a shell at its own origin: no other page can drive it on the site's origin.
//
// With no shell and an example in its URL, the frame is standalone (ADR-0112): it renders that
// example once, with no props, adds no message listener and posts no message, so any page may
// frame it and none can drive it. Its URL may ask for more (ADR-0116): `controls=true` draws the
// example's controls below it, `theme` sets its colour mode and takes the mode from its parent
// window, and `resize=true` posts its content's height to its parent window. Each is checked
// again here, since any page may open the frame by its own URL.
import { embedOptions } from "./embed-options.ts";
import type { EmbedOptions } from "./embed-options.ts";
import { layoutStyle } from "./layout.ts";
import { CONTROL_STYLES, controlKit, PALETTE } from "./panel.ts";
import {
  CONTROLS_PARAM,
  EMBED_MESSAGE,
  EXAMPLE_KEY_PREFIX,
  EXAMPLE_PARAM,
  PREVIEW_MESSAGE,
  RENDER_PATH,
  RESIZE_PARAM,
  STATIC_RENDER_MESSAGE,
  THEME_PARAM,
} from "./protocol.ts";
import type {
  EmbedResizeMessage,
  EmbedTheme,
  FrameMessage,
  FrameOptions,
  RenderMessage,
  StaticRender,
} from "./protocol.ts";

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
    void standalone(options, root, example, params);
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
    if (event.source !== window.parent || event.origin !== shell) {
      return;
    }
    const message = event.data as Partial<RenderMessage> | null;
    if (message?.type !== PREVIEW_MESSAGE || message.kind !== "render") {
      return;
    }
    if (typeof message.entry !== "string" || typeof message.seq !== "number") {
      return;
    }
    const props = message.props && typeof message.props === "object" ? message.props : {};
    queue = queue.then(() => answer({ ...(message as RenderMessage), props }));
  });
  send({ type: PREVIEW_MESSAGE, kind: "ready", target: options.target });
}

/**
 * The standalone frame (ADR-0112): the example named in its URL, rendered first with the props an
 * example takes, none, through the same `render` the shell's frames use. Its first render's
 * failure, an unknown id included, replaces the page with the message as text, so an embed is
 * never blank, and so does an option it does not take. With options, it lays the page out for
 * them, sets the colour mode before that render, and then shows the controls, takes the theme
 * message and reports the height, each only when the URL asks for it (ADR-0116).
 */
async function standalone(
  options: FrameOptions,
  root: HTMLElement,
  id: string,
  params: URLSearchParams,
): Promise<void> {
  const entry = `${EXAMPLE_KEY_PREFIX}${id}`;
  const embed = embedOptions(params, {
    controls: CONTROLS_PARAM,
    theme: THEME_PARAM,
    resize: RESIZE_PARAM,
  });
  if ("error" in embed) {
    document.body.textContent = embed.error;
    return;
  }
  const page = embedPage(options, root, entry, embed);
  const render = renderer(options, root, page.layout !== "natural");
  try {
    if (!Object.hasOwn(options.entries, entry)) {
      throw new Error(`This preview has no example ${JSON.stringify(id)}.`);
    }
    await render(entry, {});
  } catch (error) {
    document.body.textContent = errorMessage(error);
    if (embed.resize) {
      reportHeight();
    }
    return;
  }
  if (embed.controls) {
    page.listen(render);
  }
  if (embed.theme) {
    takeTheme(page.setTheme);
  }
  if (embed.resize) {
    reportHeight();
  }
}

/** The standalone page an embed's options lay out, before its first render. */
interface EmbedPage {
  /** `fixed` fits the iframe's height, `natural` grows with its content: none is today's page. */
  layout: "fixed" | "natural" | undefined;
  setTheme: (theme: EmbedTheme) => void;
  /** Rerenders the example on each change to a control, once the first render has succeeded. */
  listen: (render: ReturnType<typeof renderer>) => void;
}

/** What an embed's frame adds to the frame page's style for each layout (ADR-0116). */
const EMBED_STYLES = `
body[data-uf-embed="fixed"] { display: flex; flex-direction: column; }
body[data-uf-embed="fixed"] > [data-uf-embed-example] { flex: 1 1 auto; min-height: 0; overflow: auto; }
body[data-uf-embed="fixed"] > uf-embed-controls { flex: none; max-height: 50%; overflow: auto; }
html:has(> body[data-uf-embed="natural"]), body[data-uf-embed="natural"] { height: auto; }
[data-uf-embed-example] { display: block; }
uf-embed-controls { display: block; }
[data-uf-embed-example][data-failed] > [data-uf-preview-root] { display: none !important; }
[data-uf-embed-failure] { margin: 0; padding: 1rem; font: 13px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; overflow-wrap: anywhere; }
`;

/**
 * The controls panel's styles, in its shadow root. `all: initial` stops the inherited properties
 * a project's global styles set on `body` at the panel's host, and the shadow root keeps the
 * panel's selectors from reaching the example and the project's from reaching the panel. The
 * padding and the headings are compact, so the heading and a first field fit in half of a 150 px
 * frame, the panel's cap when the host page sets the height.
 */
const PANEL_STYLES = `
:host {
  all: initial; display: block; color-scheme: light dark;
${PALETTE}  font: 13px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif; color: var(--fg); background: var(--panel);
}
:host([data-theme="light"]) { color-scheme: light; }
:host([data-theme="dark"]) { color-scheme: dark; }
* { box-sizing: border-box; }
input, select { font: inherit; color: inherit; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
${CONTROL_STYLES}.controls { overflow: visible; border-inline-start: 0; border-top: 1px solid var(--line); padding: 6px 12px 10px; }
.controls h2 { margin: 0 0 4px; }
.controls [data-uf-group] > h3:first-child { margin: 0 0 4px; }
.controls input:not([type="checkbox"]), .controls select { padding: 2px 6px; }
`;

/**
 * Lays the standalone page out for its options: the example in an area of its own, then the
 * controls in a shadow root below it. The colour mode is set here, before the first render, so
 * the example never shows in the other mode first.
 */
function embedPage(
  options: FrameOptions,
  root: HTMLElement,
  entry: string,
  embed: EmbedOptions,
): EmbedPage {
  const html = document.documentElement;
  let host: HTMLElement | undefined;
  const setTheme = (theme: EmbedTheme) => {
    html.dataset.theme = theme;
    html.style.colorScheme = theme;
    host?.setAttribute("data-theme", theme);
  };
  const layout = embed.resize ? "natural" : embed.controls ? "fixed" : undefined;
  if (!layout) {
    if (embed.theme) {
      setTheme(embed.theme);
    }
    return { layout, setTheme, listen: () => undefined };
  }
  const style = document.createElement("style");
  style.textContent = EMBED_STYLES;
  document.head.append(style);
  document.body.dataset.ufEmbed = layout;
  const area = document.createElement("div");
  area.dataset.ufEmbedExample = "";
  root.replaceWith(area);
  area.append(root);
  const kit = controlKit();
  const groups = Object.hasOwn(options.controls ?? {}, entry) ? options.controls![entry]! : [];
  const controls = groups.flatMap((group) => group.controls);
  let section: HTMLElement | undefined;
  if (embed.controls) {
    host = document.createElement("uf-embed-controls");
    const shadow = host.attachShadow({ mode: "open" });
    const sheet = document.createElement("style");
    sheet.textContent = PANEL_STYLES;
    section = document.createElement("section");
    section.className = "controls";
    section.setAttribute("aria-labelledby", "uf-controls-label");
    const heading = document.createElement("h2");
    heading.id = "uf-controls-label";
    heading.textContent = "Controls";
    section.append(heading);
    if (!groups.length) {
      const none = document.createElement("p");
      none.textContent = "This example has no controls.";
      section.append(none);
    }
    section.append(...kit.exampleGroups(groups));
    // A field's Enter submits its form, which would load the frame again.
    section.addEventListener("submit", (event) => event.preventDefault());
    shadow.append(sheet, section);
    area.after(host);
  }
  if (embed.theme) {
    setTheme(embed.theme);
  }

  const listen = (render: ReturnType<typeof renderer>) => {
    if (!section) {
      return;
    }
    const fields = section;
    // Renders run in order, as the shell's do: a rerender must finish before the next.
    let queue: Promise<void> = Promise.resolve();
    const attempt = async (props: Record<string, unknown>) => {
      try {
        await render(entry, props);
        area.querySelector("[data-uf-embed-failure]")?.remove();
        delete area.dataset.failed;
      } catch (error) {
        // Only the example's area says why: the panel stays, so another value can render again,
        // as "(default)" does on a static Astro frame (ADR-0111).
        let failure = area.querySelector<HTMLElement>("[data-uf-embed-failure]");
        if (!failure) {
          failure = document.createElement("p");
          failure.dataset.ufEmbedFailure = "";
          area.append(failure);
        }
        failure.textContent = errorMessage(error);
        area.dataset.failed = "";
      }
    };
    fields.addEventListener("input", () => {
      const props = kit.exampleProps(controls, (key) =>
        fields.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${key}"]`)!,
      );
      queue = queue.then(() => attempt(props));
    });
  };
  return { layout, setTheme, listen };
}

/**
 * Takes the colour mode from the frame's parent window, from any origin, since the page that
 * frames an embed may be anywhere: a message of exactly the documented shape, with one of the two
 * modes. Anything else, from anywhere else, changes nothing (ADR-0116).
 */
function takeTheme(setTheme: (theme: EmbedTheme) => void): void {
  window.addEventListener("message", (event: MessageEvent<unknown>) => {
    if (event.source !== window.parent) {
      return;
    }
    const data = event.data;
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      return;
    }
    const message = data as Record<string, unknown>;
    if (Object.keys(message).length !== 3) {
      return;
    }
    if (message.type !== EMBED_MESSAGE || message.kind !== "theme") {
      return;
    }
    if (message.theme === "light" || message.theme === "dark") {
      setTheme(message.theme);
    }
  });
}

/**
 * Posts the content's height to the parent window after the first render and whenever it
 * changes. The page has its natural height here, so the measure never depends on the iframe's,
 * and a host that applies it never makes it grow. A horizontal scrollbar takes room too.
 */
function reportHeight(): void {
  const html = document.documentElement;
  let last: number | undefined;
  const report = () => {
    const scrollbar = Math.max(0, window.innerHeight - html.clientHeight);
    const height = Math.ceil(html.getBoundingClientRect().height + scrollbar);
    if (height === last) {
      return;
    }
    last = height;
    const message: EmbedResizeMessage = { type: EMBED_MESSAGE, kind: "resize", height };
    window.parent.postMessage(message, "*");
  };
  new ResizeObserver(report).observe(html);
  window.addEventListener("resize", report);
  report();
}

/**
 * The frame's render: it mounts an entry with props in a fresh container, or rerenders the entry
 * it holds in place, and throws on an entry it lacks or a mount that fails. Without `fill`, the
 * container keeps its layout but not its `min-height: 100%`.
 */
function renderer(
  options: FrameOptions,
  root: HTMLElement,
  fill = true,
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
      // An embed that reports its height takes its content's, never the frame's (ADR-0116).
      if (!fill && property === "min-height") {
        continue;
      }
      fresh.style.setProperty(property, value);
    }
    container.replaceWith(fresh);
    container = fresh;
    const load = Object.hasOwn(options.entries, entry) ? options.entries[entry] : undefined;
    if (!load) {
      throw new Error(`The preview has no entry ${JSON.stringify(entry)}.`);
    }
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
  if (!response.ok) {
    throw new Error(await response.text());
  }
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
    if (file === undefined) {
      throw new Error(STATIC_RENDER_MESSAGE);
    }
    read ??= fetch(file).then(async (response) => {
      if (!response.ok) {
        throw new Error(`${file}: ${response.status} ${response.statusText}`);
      }
      return (await response.json()) as StaticRender;
    });
    const rendered = await read.catch((error: unknown) => {
      read = undefined;
      throw error;
    });
    if (!sameProps(rendered.props, props)) {
      throw new Error(STATIC_RENDER_MESSAGE);
    }
    if ("error" in rendered) {
      throw new Error(rendered.error);
    }
    return { html: rendered.html, console: [] };
  };
}

/** Whether two sets of props hold the same keys with the same values, as JSON gives them. */
export function sameProps(
  a: Readonly<Record<string, unknown>>,
  b: Readonly<Record<string, unknown>>,
): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) {
    return false;
  }
  return keys.every(
    (key) => Object.hasOwn(b, key) && JSON.stringify(a[key]) === JSON.stringify(b[key]),
  );
}
