// The preview's frame (ADR-0088): the page each target's server serves in the shell's iframe. It
// mounts the entry the shell selects with the target's own mount adapter, rerenders it in place
// when only the props change, and answers each render. It takes messages only from its parent
// window, at the origin the shell gave in its URL, since every frame has an origin of its own.
import { PREVIEW_MESSAGE, RENDER_PATH } from "./protocol.ts";
import type { FrameMessage, FrameOptions, RenderMessage } from "./protocol.ts";

type Mounted = Awaited<ReturnType<FrameOptions["mount"]>>;

/** Starts the frame: says it is ready, then renders what the shell asks, one message at a time. */
export function startFrame(options: FrameOptions): void {
  const shell = new URLSearchParams(location.search).get("shell");
  const root = document.querySelector<HTMLElement>("[data-uf-preview-root]");
  if (!shell || !root) {
    document.body.textContent =
      "This page is a frame of unframework preview: open the preview's URL.";
    return;
  }
  let container: HTMLElement = root;
  const send = (message: FrameMessage) => window.parent.postMessage(message, shell);
  let current: { entry: string; mounted: Mounted } | undefined;
  // Renders run in order: a mount must finish before the rerender that follows it.
  let queue: Promise<void> = Promise.resolve();

  const render = async (message: RenderMessage) => {
    try {
      if (current?.entry === message.entry) {
        await current.mounted.rerender(message.props);
      } else {
        const previous = current;
        current = undefined;
        await previous?.mounted.unmount();
        // A fresh container for each mount: a framework may mark the one it rendered into, as
        // Qwik's `q:container` does, and refuse to render there again.
        const fresh = document.createElement("div");
        fresh.dataset.ufPreviewRoot = "";
        fresh.dataset.target = options.target;
        container.replaceWith(fresh);
        container = fresh;
        const load = Object.hasOwn(options.entries, message.entry)
          ? options.entries[message.entry]
          : undefined;
        if (!load) throw new Error(`The preview has no entry ${JSON.stringify(message.entry)}.`);
        const component = (await load()).default;
        if (component === undefined) {
          throw new Error(`${message.entry} has no default export to mount.`);
        }
        const mounted = await options.mount(component, container, {
          props: message.props,
          ...(options.serverRender ? { renderCommand: serverRender } : {}),
        });
        current = { entry: message.entry, mounted };
      }
      send({ type: PREVIEW_MESSAGE, kind: "rendered", target: options.target, seq: message.seq });
    } catch (error) {
      send({
        type: PREVIEW_MESSAGE,
        kind: "failed",
        target: options.target,
        seq: message.seq,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  window.addEventListener("message", (event: MessageEvent<unknown>) => {
    if (event.source !== window.parent || event.origin !== shell) return;
    const message = event.data as Partial<RenderMessage> | null;
    if (message?.type !== PREVIEW_MESSAGE || message.kind !== "render") return;
    if (typeof message.entry !== "string" || typeof message.seq !== "number") return;
    const props = message.props && typeof message.props === "object" ? message.props : {};
    queue = queue.then(() => render({ ...(message as RenderMessage), props }));
  });
  send({ type: PREVIEW_MESSAGE, kind: "ready", target: options.target });
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
