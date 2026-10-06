import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { Diagnostic, DiagnosticCode } from "@unframework/diagnostics";
import type { UfComponent, UfModule } from "@unframework/ir";

/**
 * The features a target declares support for. Each name maps to IR features (node and
 * attribute kinds, or a construct such as a single-selection list box) or to a runtime
 * ability; `requiredCapabilities` derives the ones a module uses. The capability check (P4)
 * and the test harness's `requires` read them, so what a framework renders differently is
 * declared here, never discovered.
 */
export type CapabilityName =
  /** Intrinsic elements (`ElementNode`). */
  | "element"
  /** Text nodes (`TextNode`). */
  | "text"
  /** Static attributes (`StaticAttribute`). */
  | "static-attribute"
  /**
   * A `<select>` shown as a single-selection list box: display size above 1, without
   * `multiple`, holding an option a drop-down would select (`listBoxSize`). A bound or spread
   * `size`, and options in a conditional or a list, count: what only the run time knows is
   * taken to be one.
   */
  | "listbox"
  /** Running event handlers and updating the DOM in the browser. */
  | "interactivity"
  /** Props: a component whose props type has members (ADR-0034). */
  | "props"
  /** Expressions rendered as text (`InterpolationNode`). */
  | "interpolation"
  /** Conditionals: `c ? <A/> : <B/>`, `c && <A/>` (`IfNode`). */
  | "conditional"
  /** Keyed lists: `items.map((item) => <li key={…}/>)` (`ForNode`), content and order. */
  | "list"
  /** Several roots: a component's render root that is a `FragmentNode`. */
  | "fragment"
  /** Attributes bound to an expression (`BoundAttribute`). */
  | "bound-attribute"
  /** A `class` built from static names, toggles and dynamic parts (`ClassAttribute`). */
  | "class-binding"
  /** A `style` as declarations, static or bound (`StyleAttribute`). */
  | "style-binding"
  /** A spread of an object whose keys its type declares (`SpreadAttribute`). */
  | "attribute-spread"
  /** SVG: an `<svg>` element and the SVG inside it. */
  | "svg";

/** Every capability name, in a stable order. */
export const CAPABILITY_NAMES: readonly CapabilityName[] = [
  "element",
  "text",
  "static-attribute",
  "listbox",
  "interactivity",
  "props",
  "interpolation",
  "conditional",
  "list",
  "fragment",
  "bound-attribute",
  "class-binding",
  "style-binding",
  "attribute-spread",
  "svg",
];

/** How a target supports a capability (plan §5.7). */
export type CapabilityCell =
  | { support: "native" }
  | {
      support: "emulated";
      /** The name of the inline helper the target emits. */
      helper: string;
      note?: string;
    }
  | {
      support: "unsupported";
      /** The portability diagnostic reported where a module first uses the capability. */
      code: DiagnosticCode;
      severity: "error" | "warning" | "info";
      reason: string;
    };

/** A target's capability matrix: one cell per capability. */
export type Capabilities = Readonly<Record<CapabilityName, CapabilityCell>>;

/** A file a target emits. */
export interface OutputFile {
  /** The path relative to the target's output directory, with forward slashes. */
  path: string;
  contents: string;
}

/** What a target's `emit` receives besides the component. */
export interface EmitContext {
  /** The module the component belongs to. */
  module: UfModule;
  /** The target's validated options. */
  options: unknown;
  /** Reports a diagnostic; the compiler sets its file and target. */
  report(diagnostic: Omit<Diagnostic, "file" | "target">): void;
}

/** A compile target: one framework, at one major version. */
export interface Target {
  /** An open string, such as `"react"`; third-party targets are welcome. */
  readonly name: string;
  /** The framework package and the version range the output is tested against. */
  readonly framework: { readonly package: string; readonly range: string };
  readonly capabilities: Capabilities;
  /** Validates the target's options. */
  readonly options?: StandardSchemaV1;
  /** Emits one component as one or more files. Never throws: report problems instead. */
  emit(component: UfComponent, context: EmitContext): OutputFile[];
}

/** Declares a target, checking its shape at compile time. */
export function defineTarget<T extends Target>(target: T): T {
  return target;
}
