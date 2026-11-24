import type { ComponentProps, JSX } from "@solidjs/web";
import { createRenderEffect, createSignal, getObserver, untrack } from "solid-js";

export default function Reply(
  props: Omit<ComponentProps<"form">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const [message, setMessage] = createState("Thanks, see you soon");
  const [signature, setSignature] = createState("Ada");

  return (
    <form aria-label="Reply" {...props}>
      <textarea
        aria-label="Message"
        value={untrack(message)}
        ref={[modelText(message, setMessage, { trim: true }), textCaret]}
      />
      <textarea
        aria-label="Signature"
        value={untrack(signature)}
        ref={[modelText(signature, setSignature, { lazy: true }), textCaret]}
      />
      <output>
        [{message()}] from {signature()}
      </output>
    </form>
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

/** Puts a field's caret after its text, as setting the text of an empty field leaves it. */
function textCaret(field: HTMLTextAreaElement) {
  const text = field.value;
  field.value = "";
  field.value = text;
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
