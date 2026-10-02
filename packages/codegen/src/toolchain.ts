// The toolchain contract (plan §5.7): what tests and tooling need to build, check and run a
// target's output. A target ships it as `@unframework/<target>/toolchain` (Node),
// `…/toolchain/client` (the browser mount adapter) and `…/toolchain/server` (the SSR
// renderer). Types only: nothing here runs, and the target's main entry never imports it.
import type { UserConfig } from "vite";

/** A message from a framework compiler or a type checker. Lines and columns are 1-based. */
export interface ToolchainMessage {
  message: string;
  line?: number;
  column?: number;
  /** The tool's own code, such as `TS2322`, `NG8002` or `a11y_missing_attribute`. */
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
}

/** Declares a toolchain, checking its shape at compile time. */
export type DefineToolchain = (toolchain: Toolchain) => Toolchain;

/** What a test mounts a component with. */
export interface MountOptions {
  props?: Readonly<Record<string, unknown>>;
}

/** A console message captured outside the page, such as during Astro's server render. */
export interface CapturedConsoleMessage {
  level: "warn" | "error";
  message: string;
}

/** A component mounted by a target's adapter. */
export interface MountedComponent {
  /** Resolves once the framework has flushed every pending update and effect. */
  settle(): Promise<void>;
  unmount(): Promise<void>;
  /** Console messages emitted where the page could not capture them. */
  console?: CapturedConsoleMessage[];
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
