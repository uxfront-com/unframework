// The Vue target's options (ADR-0112): `vapor` writes Vapor components, Vue 3.6's compile mode
// without a virtual DOM. A Standard Schema written by hand: the target's main entry imports only
// `ir` and `codegen`.
import type { Capabilities, Target } from "@unframework.dev/codegen";

/** A Standard Schema, as a target declares one. */
type Schema = NonNullable<Target["options"]>;
/** A problem the schema reports. */
type Issue = { message: string; path?: PropertyKey[] };

/** The options `targetOptions.vue` takes. */
export interface VueOptions {
  /**
   * Writes each component as a Vapor component, `<script setup vapor>`, which Vue 3.6 compiles
   * without a virtual DOM. Defaults to `false`. Experimental while Vue 3.6 is a release candidate.
   */
  readonly vapor?: boolean;
}

/** The options as the schema returns them, every default filled in. */
export interface ResolvedVueOptions {
  readonly vapor: boolean;
}

/** The keys the options take. */
const KEYS: readonly string[] = ["vapor"];

/** Validates `targetOptions.vue`: an object whose only key is a boolean `vapor`. */
export const vueOptions: Schema = {
  "~standard": {
    version: 1,
    vendor: "unframework",
    validate(value: unknown): { value: ResolvedVueOptions } | { issues: Issue[] } {
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return { issues: [{ message: "must be an object, such as `{ vapor: true }`." }] };
      }
      const issues: Issue[] = [];
      for (const key of Reflect.ownKeys(value)) {
        if (typeof key === "string" && KEYS.includes(key)) continue;
        issues.push({
          message: `is not an option of the vue target, which takes ${KEYS.map((name) => `\`${name}\``).join(", ")}.`,
          path: [key],
        });
      }
      const { vapor } = value as { vapor?: unknown };
      if (vapor !== undefined && typeof vapor !== "boolean") {
        issues.push({ message: "must be `true` or `false`.", path: ["vapor"] });
      }
      return issues.length ? { issues } : { value: { vapor: vapor === true } };
    },
  },
};

/** Whether the validated options turn Vapor on. */
export function isVapor(options: unknown): boolean {
  return (options as Partial<ResolvedVueOptions> | undefined)?.vapor === true;
}

/**
 * The cells Vapor components support differently from the virtual DOM's (ADR-0112). Each reason
 * names Vapor, since the diagnostic reads "The vue target does not support …".
 */
export function vaporCapabilities(options: unknown): Partial<Capabilities> {
  if (!isVapor(options)) return {};
  return {
    // Vapor's directives are functions, which Vapor applies in an order of its own, where the
    // virtual DOM runs a descendant's hooks before its ancestor's (`directive.ts`).
    directive: {
      support: "emulated",
      helper: "queueHook",
      note: "A Vapor directive is a function of the element and a getter of the value, `VaporDirective`, whose hooks run from a post-flush effect and watcher, and its cleanup. Vapor applies an element's directives in an order of its own, so the hooks go through an inline queue, `queueHook`, which runs them in Vue's order once the turn ends.",
    },
  };
}
