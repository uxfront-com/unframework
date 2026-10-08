// The toolchain contract (plan §5.7): what tests and tooling need to build, check and run a
// target's output. A target ships it as `@unframework/<target>/toolchain` (Node),
// `…/toolchain/client` (the browser mount adapter) and `…/toolchain/server` (the SSR
// renderer). Types only: nothing here runs, and the target's main entry never imports it.
import type { UserConfig } from "vite";

/**
 * A message from a framework compiler, a type checker or a linter. Lines and columns are
 * 1-based.
 */
export interface ToolchainMessage {
  message: string;
  line?: number;
  column?: number;
  /**
   * The tool's own code, such as `TS2322`, `NG8002`, `a11y_missing_attribute` or, for a lint
   * rule, its name (`no-debugger`, `vue/require-v-for-key`).
   */
  code?: string;
}

/** What a framework's own compiler said about one file (layer L3). */
export interface FrameworkCompileResult {
  errors: ToolchainMessage[];
  warnings: ToolchainMessage[];
}

/** An output file to check, by absolute path. */
export interface ToolchainFile {
  path: string;
  contents: string;
}

/** Where a toolchain finds its tools and runs its projects. */
export interface ToolchainContext {
  /**
   * The directory whose `node_modules` provide the heavy tools that cannot be dependencies of the
   * target package, such as the TypeScript 6 checkers and Angular's compiler. In this repo that is
   * `tests/toolchains/<target>`; in a user's project it is the project root.
   */
  toolchainDir: string;
  /** The root of the Vite or Vitest project that runs the output. */
  root: string;
}

/** A Vitest browser command: runs in Node, called from the browser. */
export type ToolchainCommand = (context: unknown, ...args: never[]) => unknown;

/** The Node side of a target's toolchain. */
export interface Toolchain {
  /** The target's name, such as `"react"`. */
  readonly name: string;
  /**
   * The Vite configuration of a test project for this target, merged after the unframework
   * plugin: the framework's own plugins, `optimizeDeps`, `resolve.dedupe` and so on. `ssr`
   * projects render on the server in Node; `browser` projects mount in Chromium.
   */
  vite(mode: "browser" | "ssr", context: ToolchainContext): UserConfig | Promise<UserConfig>;
  /** Browser commands the mount adapter calls, such as Astro's server-side render. */
  browserCommands?(context: ToolchainContext): Record<string, ToolchainCommand>;
  /** The module specifier of the browser mount adapter, which exports `mount: MountAdapter`. */
  readonly client: string;
  /** The module specifier of the SSR renderer, which exports `renderToString: SsrRenderer`. */
  readonly server: string;
  /**
   * L3: runs the framework's own compiler over output files and collects errors and warnings,
   * by file path. Clean output yields `{ errors: [], warnings: [] }` for every file.
   */
  frameworkCompile(
    files: readonly ToolchainFile[],
    context: ToolchainContext,
  ): Promise<Map<string, FrameworkCompileResult>>;
  /**
   * L4: type-checks output files (absolute paths) in one checker run, and returns every
   * diagnostic by file path. A checker that cannot start rejects: a gate that cannot start
   * fails.
   */
  typecheck(
    files: readonly string[],
    context: ToolchainContext,
  ): Promise<Map<string, ToolchainMessage[]>>;
  /**
   * L5: lints output files (absolute paths) with the framework's own lint rules and the shared
   * baseline, and returns every message by file path, as `typecheck` does: an entry for each
   * file, empty when it is clean, and one for any other path a linter reports. A warning is a
   * message too. A linter that cannot start, cannot load its configuration or plugins, skips a
   * file or prints output the toolchain cannot read rejects.
   */
  lint(
    files: readonly string[],
    context: ToolchainContext,
  ): Promise<Map<string, ToolchainMessage[]>>;
}

/** Declares a toolchain, checking its shape at compile time. */
export type DefineToolchain = (toolchain: Toolchain) => Toolchain;

/**
 * An event a component declares with `defineEmits` (ADR-0047), as a mount adapter listens to it:
 * its name in the source, and the shape of its payload, which an adapter whose framework
 * delivers one value per event needs to give the listener the arguments back (Angular's
 * `output()` emits nothing for an empty payload, the value for one required member, and a tuple
 * otherwise).
 */
export interface MountEvent {
  /** The event's name as the source declares it, `change`: each adapter spells it its own way. */
  name: string;
  /** Whether each member of the event's named tuple is optional, in order. */
  optional: readonly boolean[];
}

/** A listener a test gives a mounted component: the arguments of one emit, as the source passed them. */
export type MountListener = (...args: unknown[]) => void;

/** What a test mounts a component with. */
export interface MountOptions {
  props?: Readonly<Record<string, unknown>>;
  /**
   * Listeners for events the component declares, by the source's event name (`change`), never a
   * framework's spelling: each adapter passes each listener the way its framework's consumer
   * would (React's and Solid's `onChange` prop, Vue's `onChange` listener, Svelte's `onchange`
   * prop, Angular's output, Qwik's `onChange$` QRL) and keeps it across `rerender`, which
   * replaces the props alone. Astro's components run no client code, so its adapter has none.
   */
  on?: Readonly<Record<string, MountListener>>;
  /** The events the component declares, every one `on` names among them (see {@link MountEvent}). */
  events?: readonly MountEvent[];
}

/** A console message captured outside the page, such as during Astro's server render. */
export interface CapturedConsoleMessage {
  level: "warn" | "error";
  message: string;
}

/** What a render reports beyond the page: a mount's, or a rerender's. */
export interface RenderReport {
  /** Console messages emitted where the page could not capture them. */
  console?: CapturedConsoleMessage[];
}

/** A component mounted by a target's adapter. */
export interface MountedComponent extends RenderReport {
  /**
   * Resolves once the framework has flushed every pending update and effect it knows of. The
   * test calls it in a loop, with two frames between calls, until the DOM and the emitted events
   * stop changing: work a handler continues after an `await` lands in a later round.
   */
  settle(): Promise<void>;
  /**
   * Renders the component again with new props, as a parent that re-renders it would (plan
   * §7.2, L8), and resolves once the update has settled, as the mount does. The props are
   * replaced whole: a key `props` lacks is removed, so the prop takes its default, and is never
   * set to `undefined` in its place, except on a framework that cannot unset a prop (Angular's
   * inputs), where `undefined` is the only way to remove it.
   */
  rerender(props: Readonly<Record<string, unknown>>): Promise<RenderReport | void>;
  /**
   * Runs a user's action (a click, typing, a key: real input the test sends to the page) the way
   * the framework needs it run, and resolves with its result once the work it started is done:
   * React runs it inside `act`, and Qwik waits for the handlers it loads lazily. Without it the
   * action runs as it is. The test settles after it either way (`settle`, until the page is
   * quiet), so the adapter need not repeat that.
   */
  interact?<T>(action: () => Promise<T>): Promise<T>;
  unmount(): Promise<void>;
}

/** Mounts a compiled component into a container, in the browser. */
export type MountAdapter = (
  component: unknown,
  container: HTMLElement,
  options: MountOptions,
) => Promise<MountedComponent>;

/**
 * Renders a compiled component on the server and returns only the component's HTML: no
 * document shell, container or framework scripts.
 */
export type SsrRenderer = (component: unknown, options: MountOptions) => Promise<string>;
