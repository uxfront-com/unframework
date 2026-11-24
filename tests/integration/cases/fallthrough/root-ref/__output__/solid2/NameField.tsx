import type { ComponentProps, JSX } from "@solidjs/web";
import { createSignal, getObserver, omit, onCleanup, onSettled } from "solid-js";

export default function NameField(
  props: { label: string } & Omit<
    ComponentProps<"input">,
    "label" | "class" | "style" | "onFocus"
  > & {
      class?: string;
      style?: JSX.CSSProperties;
      onFocus?: Extract<ComponentProps<"input">["onFocus"], (event: never) => void>;
    },
) {
  const others = omit(props, "label", "onFocus");

  let input: HTMLInputElement | null = null;
  const [mounted, setMounted] = createState(false);

  onSettled(() => {
    setMounted(input !== null);
  });

  function fill() {
    if (input && !input.value && mounted()) input.value = "Ada";
  }

  return (
    <input
      ref={clearedRef(
        (element) => {
          input = element;
        },
        () => {
          input = null;
        },
      )}
      name="name"
      aria-label={props.label}
      onFocus={(event) => {
        fill();
        props.onFocus?.(event);
      }}
      {...others}
    />
  );
}

/** A `ref` that calls `callback` with its element, and `clear` once the element is removed. */
function clearedRef<T>(callback: (element: T) => void, clear: () => void): (element: T) => void {
  onCleanup(clear);
  return callback;
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
