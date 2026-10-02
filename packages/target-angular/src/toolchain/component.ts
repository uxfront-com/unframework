import { reflectComponentType, type Type } from "@angular/core";

/**
 * The component a test mounts or renders, checked to be an AOT-compiled Angular component, so a
 * module that skipped ngtsc fails here with its cause instead of deep inside Angular, or, where
 * the JIT compiler is loaded, instead of rendering code no user ships.
 */
export function angularComponent(component: unknown): Type<unknown> {
  if (
    typeof component === "function" &&
    isAotCompiled(component) &&
    reflectComponentType(component as Type<unknown>)
  ) {
    return component as Type<unknown>;
  }
  const actual =
    typeof component !== "function"
      ? component === null
        ? "null"
        : typeof component
      : Object.getOwnPropertyDescriptor(component, "ɵcmp")?.get
        ? `${component.name || "an anonymous component"}, which the JIT compiler would compile at runtime`
        : `the function ${component.name || "(anonymous)"}`;
  throw new TypeError(
    `Expected an AOT-compiled Angular component, got ${actual}. Was the module compiled by the ` +
      "Angular toolchain's ngtsc plugin?",
  );
}

/**
 * Whether ngtsc defined the component: AOT output declares `static ɵcmp = ɵɵdefineComponent(…)`,
 * an own data property, where a JIT-decorated class gets a getter that compiles on first read.
 */
function isAotCompiled(type: Function): boolean {
  const definition = Object.getOwnPropertyDescriptor(type, "ɵcmp");
  return definition !== undefined && "value" in definition;
}
