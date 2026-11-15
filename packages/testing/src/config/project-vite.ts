// A project's own Vite config (`vite` in `unframework.config.ts`, ADR-0104): each server that
// `unframework test`, `visual` and `preview` start calls the function for itself, puts the
// project's plugins before the unframework plugin and merges every other key into its own config,
// which the project never replaces. And the declaration that lets Angular's compile take any
// pass-through module with no type file from the project.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { ToolchainContext } from "@unframework.dev/codegen";
import { DEFAULT_PASS_THROUGH } from "@unframework.dev/compiler";
import type { UnframeworkConfig, ViteContext } from "@unframework.dev/compiler";
import type { Plugin } from "vite";
import { mergeConfig } from "vitest/config";

/** The project's `vite` function, as `unframework.config.ts` gives it. */
export type ProjectVite = UnframeworkConfig["vite"];

/** What `ToolchainContext.plugins` takes: a function that makes a fresh set of Vite plugins. */
export type ProjectPlugins = NonNullable<ToolchainContext["plugins"]>;

/**
 * The keys every server sets for itself, which the project's config may not set: its root, its
 * caches, its Vitest options, and the preview's refusal to load a Vite config of its own or to
 * listen beyond this machine (ADR-0088).
 */
export const OWNED_KEYS: readonly string[] = [
  "root",
  "base",
  "cacheDir",
  "test",
  "configFile",
  "envDir",
];

/**
 * The `server` keys every server sets for itself: the preview listens on `127.0.0.1` alone, and an
 * HMR server of its own (`server.hmr`) would open a WebSocket server that listens beyond it.
 */
export const OWNED_SERVER_KEYS: readonly string[] = ["host", "port", "strictPort", "hmr"];

/** Where every message about the field points. */
const FIELD = "vite in unframework.config.ts";

/** The project's config for one server: its plugins, flattened, and every other key. */
interface ServerConfig {
  plugins: Plugin[];
  rest: Record<string, unknown>;
}

/**
 * Calls the project's `vite` for one server, and checks what it gives. Throws, naming the field
 * and the reason, when it throws, a promise it gives rejects, it gives something that is no
 * config or no plugin, or it sets a key the server owns: a check that cannot start fails, and
 * says why.
 */
async function serverConfig(vite: ProjectVite, context: ViteContext): Promise<ServerConfig> {
  if (!vite) return { plugins: [], rest: {} };
  let made: unknown;
  try {
    made = await vite(context);
  } catch (error) {
    throw failed("threw", error);
  }
  if (typeof made !== "object" || made === null || Array.isArray(made)) {
    throw new Error(
      `[uf] ${FIELD} gave ${describeValue(made)}, which is no Vite config: return an object, such as \`{ plugins: [engine()] }\`.`,
    );
  }
  const { plugins, ...rest } = made as Record<string, unknown>;
  const owned = OWNED_KEYS.filter((key) => key in rest);
  const server = rest.server;
  // Anything but an object would replace the server's own `server` block, its host included.
  if (
    "server" in rest &&
    (typeof server !== "object" || server === null || Array.isArray(server))
  ) {
    throw new Error(
      `[uf] ${FIELD} gives \`server\` as ${describeValue(server)}, which is no object: give the server keys it may set, such as \`{ fs: { allow: [".."] } }\`.`,
    );
  }
  if (server) {
    const keys = Object.keys(server);
    owned.push(
      ...OWNED_SERVER_KEYS.filter((key) => keys.includes(key)).map((key) => `server.${key}`),
    );
  }
  if (owned.length) {
    throw new Error(
      `[uf] ${FIELD} sets ${owned.map((key) => `\`${key}\``).join(", ")}, which the ${context.mode} server for ${context.target} sets itself: leave ${owned.length > 1 ? "them" : "it"} out.`,
    );
  }
  return { plugins: await flattenPlugins(plugins), rest };
}

/**
 * A server's config with the project's merged in (ADR-0104): the project's plugins first, before
 * the unframework plugin, and every other key merged after the server's own with Vite's
 * `mergeConfig`, so a list such as `optimizeDeps.include` adds to the server's.
 */
export async function withProjectVite<T extends object>(
  config: T,
  vite: ProjectVite,
  context: ViteContext,
): Promise<T> {
  const project = await serverConfig(vite, context);
  const own = (config as { plugins?: unknown }).plugins;
  const merged = mergeConfig(config as Record<string, unknown>, project.rest);
  return { ...merged, plugins: [...project.plugins, ...(Array.isArray(own) ? own : [])] } as T;
}

/**
 * The project's plugins for one server, as `ToolchainContext.plugins` takes them: each call makes
 * a fresh set for a server of the toolchain's own, such as Astro's render server, which takes
 * the plugins alone.
 */
export function projectPlugins(vite: ProjectVite, context: ViteContext): ProjectPlugins {
  return async () => (await serverConfig(vite, context)).plugins;
}

/** A plugin option in any shape Vite's `plugins` takes, flattened: read as `unknown`, since the project's code gives it. */
async function flattenPlugins(option: unknown): Promise<Plugin[]> {
  let value: unknown;
  try {
    value = await option;
  } catch (error) {
    throw failed("gave a promise that rejected", error);
  }
  if (value === false || value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    return (await Promise.all(value.map((each: unknown) => flattenPlugins(each)))).flat();
  }
  if (typeof value !== "object" || typeof (value as { name?: unknown }).name !== "string") {
    throw new Error(
      `[uf] ${FIELD} gave ${describeValue(value)} among its plugins, which is no Vite plugin: a plugin is an object with a name.`,
    );
  }
  return [value as Plugin];
}

/**
 * The error of a function or a promise of the field's that failed. The CLI prints a message
 * alone, so the reason is in it, as well as in `cause`.
 */
function failed(what: string, error: unknown): Error {
  const reason =
    error instanceof Error
      ? String(error.message) || "an error with no message"
      : describeValue(error);
  return new Error(`[uf] ${FIELD} ${what}: ${reason}`, { cause: error });
}

/** A value as a message names it, whatever it is. */
function describeValue(value: unknown): string {
  switch (typeof value) {
    case "string":
      return JSON.stringify(value);
    case "object":
      if (value === null) return "null";
      if (Array.isArray(value)) return "a list";
      return "name" in value ? "an object whose name is no string" : "an object without a name";
    case "function":
      return "a function";
    case "symbol":
      return value.toString();
    case "number":
    case "bigint":
    case "boolean":
      return `${value}`;
    default:
      return "undefined";
  }
}

/** The declaration file's contents: one wildcard module for each pass-through prefix. */
export const PASS_THROUGH_DECLARATIONS: string = [
  "// Written by @unframework.dev/testing (ADR-0104): Angular's compile in `unframework test`,",
  "// `visual` and `preview` takes any module that passes through as written. The project's own",
  "// source check (tsconfig.uf.json) reads the real types.",
  ...DEFAULT_PASS_THROUGH.map((prefix) => `declare module "${prefix}*";`),
  "",
].join("\n");

/**
 * The declarations every toolchain reads beside the outputs (`ToolchainContext.declarations`):
 * one file, written under the root's `node_modules/.cache/unframework/`, since the packages ship
 * `dist` alone. It is written only when it differs, through a rename, so runs that share a root
 * never read half of it.
 */
export function passThroughDeclarations(root: string): string[] {
  const file = join(root, "node_modules", ".cache", "unframework", "pass-through.d.ts");
  let current: string | undefined;
  try {
    current = readFileSync(file, "utf8");
  } catch {
    current = undefined;
  }
  if (current !== PASS_THROUGH_DECLARATIONS) {
    mkdirSync(dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.tmp`;
    writeFileSync(temporary, PASS_THROUGH_DECLARATIONS);
    renameSync(temporary, file);
  }
  return [file];
}
