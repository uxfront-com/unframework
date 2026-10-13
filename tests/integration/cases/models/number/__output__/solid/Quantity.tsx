import { type JSX, createRenderEffect, createSignal, untrack } from "solid-js";

export default function Quantity(props: { class?: string; style?: JSX.CSSProperties }) {
  const [count, setCount] = createSignal(2);
  const [volume, setVolume] = createSignal(5);

  return (
    <section aria-label="Order" class={props.class} style={props.style}>
      <input
        type="number"
        aria-label="Count"
        min="0"
        {...modelText(count, setCount, { number: true })}
      />
      <input
        type="range"
        aria-label="Volume"
        min="0"
        max="10"
        {...modelText(volume, setVolume, { number: true })}
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
function modelText<T extends string | number>(
  value: () => T,
  setValue: (value: T) => void,
  modifiers: { trim?: boolean; lazy?: boolean; number?: boolean },
): { value: T; ref: (field: HTMLInputElement | HTMLTextAreaElement) => void } {
  const cast = (text: string): string | number => {
    const number = Number.parseFloat(text);
    return Number.isNaN(number) ? text : number;
  };
  return {
    value: untrack(value),
    ref(field) {
      field.addEventListener(modifiers.lazy ? "change" : "input", () => {
        const text = modifiers.trim ? field.value.trim() : field.value;
        setValue((modifiers.number ? cast(text) : text) as T);
      });
      if (modifiers.trim) {
        field.addEventListener("change", () => {
          field.value = field.value.trim();
        });
      }
      createRenderEffect(() => {
        const next = value();
        const shown =
          modifiers.number && !/^0\d/.test(field.value) ? cast(field.value) : field.value;
        if (shown === next) return;
        const typing = document.activeElement === field && field.type !== "range";
        if (typing && modifiers.trim && field.value.trim() === next) return;
        field.value = String(next);
      });
    },
  };
}
