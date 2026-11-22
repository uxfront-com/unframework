import type { ComponentProps, JSX } from "@solidjs/web";
import { Show, createSignal, getObserver, omit } from "solid-js";

export interface DisclosureSlots {
  children?: JSX.Element;
}

export default function Disclosure(
  props: DisclosureSlots &
    Omit<ComponentProps<"div">, "children" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "children", "class");

  const [open, setOpen] = createState(false);

  return (
    <div class={props.class ? `disclosure ${props.class}` : "disclosure"} {...others}>
      <button
        type="button"
        aria-expanded={enumeratedValue(open())}
        onClick={() => setOpen(!open())}
      >
        Details
      </button>
      <Show when={open()}>
        <div class="body">{props.children}</div>
      </Show>
    </div>
  );
}

/** An enumerated attribute's value: a boolean as `"true"` or `"false"`, as Vue writes it. */
function enumeratedValue<T>(value: T): T extends boolean ? `${T}` : T {
  return (typeof value === "boolean" ? String(value) : value) as T extends boolean ? `${T}` : T;
}

/**
 * Vue's `ref`: a signal whose read returns the value last written, as Vue's does, and tracks the
 * signal where something observes it. Solid applies a write when it flushes.
 */
function createState<T>(): [() => T | undefined, (value: T | undefined) => void];
function createState<T>(initial: T): [() => T, (value: T) => void];
function createState<T>(initial?: T): [() => T | undefined, (value: T | undefined) => void] {
  let current = initial;
  // A version, never the value: `createSignal` would take a function for a computation.
  const [tracked, notify] = createSignal(0, { ownedWrite: true });
  function read(): T | undefined {
    if (getObserver()) tracked();
    return current;
  }
  function write(value: T | undefined): void {
    if (Object.is(value, current)) return;
    current = value;
    notify((version) => version + 1);
  }
  return [read, write];
}
