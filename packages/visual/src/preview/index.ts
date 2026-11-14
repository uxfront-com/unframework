// `startPreview` (plan §8.6, ADR-0088): every example and component of a project side by side on
// every target, for development. One Vite dev server per target serves the selection in a frame of
// its own origin, and a shell server serves the page that frames them. Nothing is written under the
// sources: Angular's `.uf-tmp/` beside its compiler stack and Vite's caches under
// `node_modules/.vite` are the only writes.
import { realpathSync } from "node:fs";

import { loadConfig, resolveConfig, TARGET_NAMES } from "@unframework.dev/compiler";
import type { ResolvedConfig, TargetName } from "@unframework.dev/compiler";
import { projectPlugins, toolchainDirOf } from "@unframework.dev/testing/config";

import { VisualUsageError } from "../run.ts";
import { readCatalogue } from "./catalogue.ts";
import { startTargetServer } from "./servers.ts";
import type { TargetServer, TargetServerOptions } from "./servers.ts";
import { shellData, shellPage, startShellServer } from "./shell.ts";

/** The options of {@link startPreview}. */
export interface PreviewOptions {
  /** The project's root, where `unframework.config.ts` lies. */
  root: string;
  /** The targets to show: every one of the project's by default, in the project's order. */
  targets?: readonly TargetName[];
  /** The shell's port: any free one by default. Each target's server takes a free one. */
  port?: number;
  /**
   * Where a target's compiler stack resolves from, such as Angular's, relative to the root:
   * `package.resolveFrom` in `unframework.config.ts` by default, then the root (A9).
   */
  toolchainDirs?: Partial<Record<TargetName, string>>;
}

/** A running preview. */
export interface Preview {
  /** The shell's URL, `http://127.0.0.1:<port>/`. */
  url: string;
  /** Each target's server origin, in the order the shell shows them. */
  frames: { target: TargetName; origin: string; port: number }[];
  /** Stops every server: the shell and each target's. Calling it again does nothing more. */
  close(): Promise<void>;
}

/**
 * Starts the preview of a project, and resolves once every server listens. Throws a
 * {@link VisualUsageError} on a target the project lacks, a port that is not one, or a project
 * with nothing to show, and an error on a configuration or a toolchain that cannot load. A start
 * that fails closes what it started.
 */
export async function startPreview(options: PreviewOptions): Promise<Preview> {
  const root = realpathSync(options.root);
  const port = options.port ?? 0;
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new VisualUsageError(`The port must be a whole number from 0 to 65535, not ${port}.`);
  }
  const config = await projectConfig(root);
  const targets = previewTargets(config.targets, options.targets);
  const catalogue = await readCatalogue(root, config.srcDir);
  const entries = Object.fromEntries(
    [...catalogue.examples, ...catalogue.components].map((entry) => [entry.key, entry.file]),
  );
  if (!Object.keys(entries).length) {
    throw new VisualUsageError(
      `Nothing to preview under ${root}: add an example (*.example.uf.tsx) or a component under ${config.srcDir}.`,
    );
  }

  const started: TargetServer[] = [];
  const closeAll = async (shell?: { close(): Promise<void> }) => {
    const results = await Promise.allSettled([
      ...(shell ? [shell.close()] : []),
      ...started.map((server) => server.close()),
    ]);
    const failed = results.flatMap((result) =>
      result.status === "rejected" ? [result.reason] : [],
    );
    if (failed.length) throw new AggregateError(failed, "[uf:preview] A server failed to close.");
  };
  try {
    const servers = await Promise.allSettled(
      targets.map((target) =>
        startTargetServer(
          targetServerOptions(root, config, target, entries, options.toolchainDirs),
        ).then((server) => {
          started.push(server);
          return server;
        }),
      ),
    );
    const failed = servers.flatMap((result) =>
      result.status === "rejected" ? [result.reason] : [],
    );
    if (failed.length) {
      throw failed.length === 1
        ? failed[0]
        : new AggregateError(
            failed,
            `[uf:preview] ${failed.length} target servers failed to start.`,
          );
    }
    // In the project's order of targets, whichever started first.
    const frames = targets.map((target) => started.find((server) => server.target === target)!);
    const shell = await startShellServer(shellPage(shellData(catalogue, frames)), port);
    let closing: Promise<void> | undefined;
    return {
      url: shell.url,
      frames: frames.map((frame) => ({
        target: frame.target,
        origin: frame.origin,
        port: frame.port,
      })),
      close: () => (closing ??= closeAll(shell)),
    };
  } catch (error) {
    await closeAll().catch(() => undefined);
    throw error;
  }
}

/**
 * What a target's server serves, from the project's configuration: the entries, where the
 * target's compiler stack resolves from, and the project's Vite plugins and declarations
 * (ADR-0104).
 */
export function targetServerOptions(
  root: string,
  config: ResolvedConfig,
  target: TargetName,
  entries: Readonly<Record<string, string>>,
  toolchainDirs?: PreviewOptions["toolchainDirs"],
): TargetServerOptions {
  return {
    root,
    target,
    toolchainDir: toolchainDirOf(target, root, toolchainDirs, config.package?.resolveFrom),
    entries,
    plugins: projectPlugins(config.vitePlugins),
    declarations: config.declarations,
  };
}

/** The targets to show: the project's, or those asked for, which must be among them. */
function previewTargets(
  project: readonly TargetName[],
  requested: readonly TargetName[] | undefined,
): TargetName[] {
  if (!requested?.length) return [...project];
  const unknown = requested.filter((name) => !project.includes(name));
  if (unknown.length) {
    const known = unknown.every((name) => (TARGET_NAMES as readonly string[]).includes(name));
    throw new VisualUsageError(
      `${unknown.join(", ")} ${unknown.length > 1 ? "are" : "is"} not among ${known ? "the project's targets" : "the targets"} (${(known ? project : TARGET_NAMES).join(", ")}).`,
    );
  }
  return project.filter((name) => requested.includes(name));
}

/** The project's `unframework.config.ts`, resolved, or an error that lists its diagnostics. */
async function projectConfig(root: string): Promise<ResolvedConfig> {
  const loaded = await loadConfig(root);
  const resolved =
    loaded.raw === undefined
      ? { config: undefined, diagnostics: [] }
      : await resolveConfig(loaded.raw, loaded);
  const diagnostics = [...loaded.diagnostics, ...resolved.diagnostics];
  if (!resolved.config || diagnostics.some((each) => each.severity === "error")) {
    throw new Error(
      `[uf] ${loaded.file ?? "unframework.config.ts"} is invalid:\n  ${diagnostics.map((each) => `${each.code} ${each.message}`).join("\n  ")}`,
    );
  }
  return resolved.config;
}
