// The events each compiled component declares (ADR-0050), from the modules a run's projects
// actually compiled: the unplugin reports every compile (`onCompile`), the harness records it
// here, and the `ufComponentEvents` command answers the browser from it. Not from the committed
// `__output__/ir.json`: an update run writes that file after the browser projects have loaded
// their config, and a canary's compile may differ from it on purpose.
import { realpathSync } from "node:fs";

import type { MountEvent } from "@unframework/codegen";
import type { UfModule } from "@unframework/ir";

/** A module a project compiled, as the unplugin's `onCompile` reports it. */
export interface CompiledModule {
  /** The authored `.uf.tsx` file, absolute. */
  file: string;
  /** The target the project compiles to. */
  target: string;
  /** The compile's IR, or nothing when the module did not parse. */
  ir?: UfModule | undefined;
}

/**
 * One store per process, whatever copy of this module records or reads it: the config that
 * builds the projects and the commands it registers may load it apart.
 */
const STORE = Symbol.for("@unframework/testing:compiled-modules");

function store(): Map<string, UfModule | undefined> {
  const holder = globalThis as { [STORE]?: Map<string, UfModule | undefined> };
  return (holder[STORE] ??= new Map());
}

/** The key of a file's compile for a target: its real path, so links never split it. */
function keyOf(file: string, target: string): string {
  let path = file;
  try {
    path = realpathSync(file);
  } catch {
    // A file that no longer exists is recorded by the path it was compiled from.
  }
  return `${target}\0${path}`;
}

/** Records the latest compile of a module for a target: the harness calls it from `onCompile`. */
export function recordCompiledModule(module: CompiledModule): void {
  store().set(keyOf(module.file, module.target), module.ir);
}

/**
 * The events the component of a compiled module declares, in declaration order, each with the
 * optional members of its payload. A module of several components must declare the same events
 * in each: a case mounts one component, and cannot tell which of a module's it is. A test that
 * composes components mounts a harness parent from a source of its own (ADR-0057). Throws
 * when the module was never compiled for the target, or failed to.
 */
export function compiledEvents(file: string, target: string): MountEvent[] {
  const key = keyOf(file, target);
  const entries = store();
  if (!entries.has(key)) {
    throw new Error(
      `[uf] No ${target} compile of ${file} was recorded: the project's unplugin must report every compile to recordCompiledModule (its onCompile hook) before a spec mounts the component.`,
    );
  }
  const ir = entries.get(key);
  if (!ir) {
    throw new Error(
      `[uf] The ${target} compile of ${file} produced no IR: it has nothing to mount.`,
    );
  }
  return eventsOfModule(ir, file);
}

/** The events a module's component declares (see {@link compiledEvents}). */
export function eventsOfModule(ir: UfModule, file: string = ir.file): MountEvent[] {
  const lists = ir.components.map((component) =>
    (component.emits?.events ?? []).map((event): MountEvent => ({
      name: event.name,
      optional: event.parameters.map((parameter) => parameter.optional === true),
    })),
  );
  const [first = [], ...rest] = lists;
  const differ = rest.some((list) => JSON.stringify(list) !== JSON.stringify(first));
  if (differ) {
    throw new Error(
      `[uf] ${file} holds ${lists.length} components that declare different events, and a case mounts one of them: a test cannot tell which one it mounts until components can be composed (M3).`,
    );
  }
  return first;
}
