// The per-project mount adapter seam. A browser project's second setup file
// (`@unframework/testing/<target>`) registers its target's adapter; the shared specs only call
// `mount()`, which dispatches here.
import type { MountAdapter, MountEvent } from "@unframework/codegen";
import { inject } from "vitest";

/** What a registration may add to its adapter. */
export interface TargetOptions {
  /**
   * The events a component declares, read from the component itself: for a stub target, whose
   * components are not compiled. Without it, `mount` asks the project which events the case's
   * compiled component declares (the `ufComponentEvents` command).
   */
  events?(component: unknown): readonly MountEvent[];
}

interface Registration extends TargetOptions {
  target: string;
  mount: MountAdapter;
}

let registration: Registration | undefined;

/** Registers the project's mount adapter. One adapter per project: a second target is a bug. */
export function registerTarget(
  target: string,
  mount: MountAdapter,
  options: TargetOptions = {},
): void {
  if (registration && registration.target !== target) {
    throw new Error(
      `registerTarget("${target}"): this project already registered "${registration.target}". A browser project verifies one target.`,
    );
  }
  registration = { ...options, target, mount };
}

/** The target this project verifies (`test.provide.target`). */
export function currentTarget(): string {
  const target = inject("target");
  if (!target) {
    throw new Error("No target is provided: the project must set test.provide.target.");
  }
  return target;
}

/** The registered adapter, checked against the project's target. */
export function registeredAdapter(): Registration {
  if (!registration) {
    throw new Error(
      "No mount adapter is registered: the project's setupFiles must include @unframework/testing/<target>.",
    );
  }
  const target = currentTarget();
  if (registration.target !== target) {
    throw new Error(
      `The registered adapter is for "${registration.target}", but this project verifies "${target}".`,
    );
  }
  return registration;
}
