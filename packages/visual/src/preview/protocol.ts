// What the preview's shell and its frames say to each other (ADR-0088), through `postMessage`, and
// where a static preview keeps its files (ADR-0111). Types and constants only, so the frame's
// browser code imports this file without Node.
import type { ExampleControlGroup } from "./instrument.ts";

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

/**
 * The page that opens one example on one target by its own URL (ADR-0112):
 * `embed.html?example=<id>&target=<target>`, beside the shell, at `<out>/embed.html` in a static
 * preview and at `/embed.html` on the dev shell's server. It sends the browser on to that target's
 * frame page in standalone mode.
 */
export const EMBED_FILE = "embed.html";

/**
 * The query parameter that names an example by its id, on {@link EMBED_FILE} and on a frame page
 * in standalone mode, which renders that example alone and takes no messages (ADR-0112).
 */
export const EXAMPLE_PARAM = "example";

/** The query parameter of {@link EMBED_FILE} that names the target, as the shell's captions do. */
export const TARGET_PARAM = "target";

/**
 * The query parameter of {@link EMBED_FILE} and of a standalone frame that shows the example's
 * controls below it, `controls=true` (ADR-0116).
 */
export const CONTROLS_PARAM = "controls";

/**
 * The query parameter of {@link EMBED_FILE} and of a standalone frame that sets its colour mode,
 * `theme=light` or `theme=dark`, and lets the page that frames it change the mode with an
 * {@link EmbedThemeMessage} (ADR-0116).
 */
export const THEME_PARAM = "theme";

/**
 * The query parameter of {@link EMBED_FILE} and of a standalone frame that makes it post its
 * content's height to the page that frames it, `resize=true`, in an {@link EmbedResizeMessage}
 * (ADR-0116).
 */
export const RESIZE_PARAM = "resize";

/**
 * Marks an embed's messages: the public ones an embed and the page that frames it exchange
 * (ADR-0116), apart from the shell's, {@link PREVIEW_MESSAGE}, which are not public.
 */
export const EMBED_MESSAGE = "unframework:embed";

/** The colour modes an embed takes. */
export type EmbedTheme = "light" | "dark";

/** The page that frames an embed sets its colour mode, if the embed's URL has a `theme`. */
export interface EmbedThemeMessage {
	type: typeof EMBED_MESSAGE;
	kind: "theme";
	theme: EmbedTheme;
}

/** An embed with `resize=true` says how tall its content is, in whole CSS pixels. */
export interface EmbedResizeMessage {
	type: typeof EMBED_MESSAGE;
	kind: "resize";
	height: number;
}

/** The start of an example's entry key, `example:<id>`, as `entryKey` writes it. */
export const EXAMPLE_KEY_PREFIX = "example:";

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

/**
 * How an example sits in its frame (ADR-0114): a flex layout on the frame's mount container, which
 * an example's `@layout` tag sets, or a plain block that fills the frame (`@layout none`). An entry
 * without one takes {@link DEFAULT_LAYOUT}.
 */
export type PreviewLayout =
	| { display: "block" }
	| {
			display: "flex";
			direction: "row" | "column";
			justify: "start" | "center" | "end" | "between" | "around" | "evenly";
			align: "start" | "center" | "end" | "stretch" | "baseline";
			wrap: boolean;
			/** A CSS length: `0`, or a number in `px`, `rem` or `em`. */
			gap: string;
	  };

/** The layout of an entry that sets none: centred on both axes, in a row, with no gap. */
export const DEFAULT_LAYOUT: Extract<PreviewLayout, { display: "flex" }> = {
	display: "flex",
	direction: "row",
	justify: "center",
	align: "center",
	wrap: false,
	gap: "0",
};

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
	/**
	 * The layout of each entry that sets one, by key (ADR-0114). The frame puts it, or
	 * {@link DEFAULT_LAYOUT}, on the fresh container of each mount.
	 */
	layouts?: Record<string, PreviewLayout>;
	/**
	 * The control groups of each example that has any, by key (ADR-0113), which a standalone frame
	 * shows with `controls=true` (ADR-0116).
	 */
	controls?: Record<string, Array<ExampleControlGroup>>;
}
