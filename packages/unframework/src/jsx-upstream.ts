/**
 * The owned alias over the vendored upstream JSX types (ADR-0017).
 *
 * This is the only module that imports `./vendor/*`. Everything else names the `Upstream*` aliases
 * below, so replacing Vue's types with another upstream, or with a surface unframework generates
 * itself, is a change to this one file plus a probe run.
 */
export type {
  /** Per-tag attribute interfaces, with HTML attribute names: `class`, `for`, `tabindex`, `aria-*`. */
  IntrinsicElementAttributes as UpstreamIntrinsicElements,
  /** Global HTML attributes, including the `on*` handlers. */
  HTMLAttributes as UpstreamHTMLAttributes,
  /** Event name to event type, in Vue's casing: `onClick`, `onKeydown`, `onDblclick`. */
  Events as UpstreamEvents,
  ClassValue,
  StyleValue,
  CSSProperties,
} from "./vendor/vue-jsx.d.ts";
