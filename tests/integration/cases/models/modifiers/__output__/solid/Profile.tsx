import { type JSX, createRenderEffect, createSignal, untrack } from "solid-js";

export default function Profile(props: { class?: string; style?: JSX.CSSProperties }) {
  const [name, setName] = createSignal("");
  const [city, setCity] = createSignal("Lisbon");
  const [weight, setWeight] = createSignal(0);

  return (
    <form aria-label="Profile" class={props.class} style={props.style} {...scopeAttributes(props)}>
      <label>
        Name <input value={untrack(name)} ref={modelText(name, setName, { trim: true })} />
      </label>
      <label>
        City <input value={untrack(city)} ref={modelText(city, setCity, { lazy: true })} />
      </label>
      <label>
        Weight{" "}
        <input value={untrack(weight)} ref={modelText(weight, setWeight, { number: true })} />
      </label>
      <output>
        [{name()}] from {city()}, {weight() + 1}
      </output>
    </form>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
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
  return (field) => {
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
    createRenderEffect(() => {
      const next = value() ?? "";
      const shown = modifiers.number && !/^0\d/.test(field.value) ? cast(field.value) : field.value;
      if (shown === next) return;
      const typing = document.activeElement === field && field.type !== "range";
      if (typing && modifiers.trim && field.value.trim() === next) return;
      field.value = String(next);
    });
  };
}
