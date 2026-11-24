import type { ComponentProps, JSX } from "@solidjs/web";
import { createRenderEffect, createSignal, getObserver, untrack } from "solid-js";

export default function Quantity(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const [count, setCount] = createState(2);
  const [volume, setVolume] = createState(5);

  return (
    <section aria-label="Order" {...props}>
      <input
        type="number"
        aria-label="Count"
        min="0"
        value={untrack(count)}
        ref={modelText(count, setCount, { number: true })}
      />
      <input
        type="range"
        aria-label="Volume"
        min="0"
        max="10"
        value={untrack(volume)}
        ref={modelText(volume, setVolume, { number: true })}
      />
      <output>
        Next: {count() + 1}, volume {volume() + 1}
      </output>
      <button type="button" onClick={() => setCount(10)}>
        Ten
      </button>
    </section>
  );
}

/** Binds a text field to a signal as Vue's `vModelText` does: see its modifiers. */
function modelText<T extends string | number | null | undefined>(
  value: () => T,
  setValue: (value: T) => void,
  modifiers: { trim?: boolean; lazy?: boolean; number?: boolean },
): (field: HTMLInputElement | HTMLTextAreaElement) => void {
  const cast = (text: string): string | number => {
    const number = Number.parseFloat(text);
    return Number.isNaN(number) ? text : number;
  };
  let bound: HTMLInputElement | HTMLTextAreaElement | undefined;
  // Created here, as the `ref` is evaluated: Solid 2 creates no computation in a `ref` callback.
  createRenderEffect(
    () => value() ?? "",
    (next) => {
      const field = bound;
      if (!field) return;
      const shown = modifiers.number && !/^0\d/.test(field.value) ? cast(field.value) : field.value;
      if (shown === next) return;
      const typing = document.activeElement === field && field.type !== "range";
      if (typing && modifiers.trim && field.value.trim() === next) return;
      field.value = String(next);
    },
  );
  return (field) => {
    bound = field;
    field.addEventListener(modifiers.lazy ? "change" : "input", () => {
      const text = modifiers.trim ? field.value.trim() : field.value;
      setValue((modifiers.number ? cast(text) : text) as T);
    });
    if (modifiers.trim || modifiers.number) {
      field.addEventListener("change", () => {
        const text = modifiers.trim ? field.value.trim() : field.value;
        field.value = String(modifiers.number ? cast(text) : text);
      });
    }
  };
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
