// What the preview's shell and its frames say to each other (ADR-0088), through `postMessage`, and
// where a static preview keeps its files (ADR-0111). Types and constants only, so the frame's
// browser code imports this file without Node.

/** Marks the preview's messages among any others a page receives. */
export const PREVIEW_MESSAGE = "unframework:preview";

/** The path each target's server serves its frame page at. */
export const FRAME_PATH = "/__uf/frame";

/** The path each target's server runs its render command at, for a target with no client runtime. */
export const RENDER_PATH = "/__uf/render";

/**
 * A static preview's frame page, in each target's directory: `<out>/<target>/frame.html`, which
 * the shell at `<out>/index.html` frames by a relative URL (ADR-0111).
 */
export const STATIC_FRAME_FILE = "frame.html";

/**
 * Where a static preview keeps the renders made at build time for a target with no client
 * runtime, relative to its frame page: `<out>/astro/renders/<n>.json`, each a
 * {@link StaticRender}.
 */
export const STATIC_RENDERS_DIR = "renders";

/** What a static preview's frame says when asked for a render the build did not make. */
export const STATIC_RENDER_MESSAGE =
  "The static preview renders this target only as each entry first shows: run unframework preview to change its controls.";

/**
 * A render made at build time: the props it was made with, and the HTML it gave or why it failed,
 * which the frame shows as a dev server's failed render.
 */
export type StaticRender =
  | { props: Record<string, unknown>; html: string }
  | { props: Record<string, unknown>; error: string };

/** The shell asks a frame to render an entry with props: mounted, or rerendered in place. */
export interface RenderMessage {
  type: typeof PREVIEW_MESSAGE;
  kind: "render";
  /** Grows with each message the shell sends, so a frame's answer names what it rendered. */
  seq: number;
  /** The entry's key, `example:<id>` or `component:<id>` (`entryKey`). */
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
  /**
   * In a static preview, for a target that renders on the server: each entry's render made at
   * build time, a {@link StaticRender} at this URL relative to the frame page. The frame reads it
   * in place of {@link RENDER_PATH}, and fails a render with other props.
   */
  staticRenders?: Record<string, string>;
  /**
   * Whether the frame is part of a static preview, where every frame shares the shell's origin
   * (ADR-0111). Such a frame takes messages from, and sends them to, a shell at its own origin only.
   */
  staticPreview?: boolean;
}
