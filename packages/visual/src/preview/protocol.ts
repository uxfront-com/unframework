// What the preview's shell and its frames say to each other (ADR-0088), through `postMessage`.
// Types and constants only, so the frame's browser code imports this file without Node.

/** Marks the preview's messages among any others a page receives. */
export const PREVIEW_MESSAGE = "unframework:preview";

/** The path each target's server serves its frame page at. */
export const FRAME_PATH = "/__uf/frame";

/** The path each target's server runs its render command at, for a target with no client runtime. */
export const RENDER_PATH = "/__uf/render";

/** The shell asks a frame to render an entry with props: mounted, or rerendered in place. */
export interface RenderMessage {
  type: typeof PREVIEW_MESSAGE;
  kind: "render";
  /** Grows with each message the shell sends, so a frame's answer names what it rendered. */
  seq: number;
  /** The entry's id, an example's or a component's. */
  entry: string;
  props: Record<string, unknown>;
}

/** A frame says it is ready for a render: on each load, a reload after Vite optimised included. */
export interface ReadyMessage {
  type: typeof PREVIEW_MESSAGE;
  kind: "ready";
  target: string;
}

/** A frame says how a render went. */
export interface RenderedMessage {
  type: typeof PREVIEW_MESSAGE;
  kind: "rendered" | "failed";
  target: string;
  seq: number;
  /** Why it failed. */
  message?: string;
}

/** The shell's messages to a frame. */
export type ShellMessage = RenderMessage;

/** A frame's messages to the shell. */
export type FrameMessage = ReadyMessage | RenderedMessage;

/** What a target's server gives its frame: the target and its entries' modules, by id. */
export interface FrameOptions {
  target: string;
  /** The adapter's `mount`, from the target's toolchain. */
  mount: (
    component: unknown,
    container: HTMLElement,
    options: Record<string, unknown>,
  ) => Promise<{
    rerender(props: Readonly<Record<string, unknown>>): Promise<unknown>;
    unmount(): Promise<void>;
  }>;
  /** Loads an entry's module, whose default export the frame mounts. */
  entries: Record<string, () => Promise<{ default?: unknown }>>;
  /** Whether the target renders on the server through {@link RENDER_PATH} (Astro). */
  serverRender: boolean;
}
