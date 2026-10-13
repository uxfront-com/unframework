import { type JSX, createRenderEffect, createSignal, untrack } from "solid-js";

export default function Profile(props: { class?: string; style?: JSX.CSSProperties }) {
  const [name, setName] = createSignal("");
  const [city, setCity] = createSignal("Lisbon");
  const [weight, setWeight] = createSignal(0);

  return (
    <form aria-label="Profile" class={props.class} style={props.style}>
      <label>
        Name <input {...modelText(name, setName, { trim: true })} />
      </label>
      <label>
        City <input {...modelText(city, setCity, { lazy: true })} />
      </label>
      <label>
        Weight <input {...modelText(weight, setWeight, { number: true })} />
      </label>
      <output>
        [{name()}] from {city()}, {weight() + 1}
      </output>
    </form>
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
