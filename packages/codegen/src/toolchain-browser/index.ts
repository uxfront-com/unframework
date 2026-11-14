// @unframework.dev/codegen/toolchain-browser: what two targets' browser adapters, or a target's
// adapter and the testing package, share at run time. It imports nothing, so it loads in a page:
// the main entry loads the printers and oxfmt, which do not.

/**
 * Props that travel to a server render as JSON (Astro's static mount, and the server HTML L12
 * hydrates, ADR-0095), which would silently drop or change a function, a symbol, `NaN` or a
 * class instance. Rejects them instead, naming the prop; `why` opens the message, such as
 * "Astro renders on the server".
 */
export function assertSerialisableProps(
  props: Readonly<Record<string, unknown>>,
  why: string,
): void {
  for (const [key, value] of Object.entries(props)) assertJsonValue(value, key, why);
}

function assertJsonValue(value: unknown, path: string, why: string): void {
  if (value === null || value === undefined) return;
  switch (typeof value) {
    case "string":
    case "boolean":
      return;
    case "number":
      if (Number.isFinite(value)) return;
      break;
    case "object": {
      if (Array.isArray(value)) {
        value.forEach((item, index) => assertJsonValue(item, `${path}[${index}]`, why));
        return;
      }
      const prototype: unknown = Object.getPrototypeOf(value);
      if (prototype === Object.prototype || prototype === null) {
        for (const [key, item] of Object.entries(value)) {
          assertJsonValue(item, `${path}.${key}`, why);
        }
        return;
      }
      break;
    }
  }
  throw new TypeError(`${why}, so props must be JSON values; \`${path}\` is ${describe(value)}.`);
}

function describe(value: unknown): string {
  if (typeof value === "number") return String(value);
  if (typeof value === "object" && value !== null) return `a ${value.constructor.name} instance`;
  return `a ${typeof value}`;
}
