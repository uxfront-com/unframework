// The per-project mount adapter seam. A browser project's second setup file
// (`@unframework/testing/<target>`) registers its target's adapter; the shared specs only call
// `mount()`, which dispatches here.
import type { MountAdapter } from "@unframework/codegen";
import { inject } from "vitest";

interface Registration {
  target: string;
  mount: MountAdapter;
}

let registration: Registration | undefined;

/** Registers the project's mount adapter. One adapter per project: a second target is a bug. */
export function registerTarget(target: string, mount: MountAdapter): void {
  if (registration && registration.target !== target) {
    throw new Error(
      `registerTarget("${target}"): this project already registered "${registration.target}". A browser project verifies one target.`,
    );
  }
  registration = { target, mount };
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
