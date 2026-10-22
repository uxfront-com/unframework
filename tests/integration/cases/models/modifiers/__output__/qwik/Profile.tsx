import { type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    const name = useSignal("");
    const city = useSignal("Lisbon");
    const weight = useSignal(0);

    const currentName = name.value;
    const nameInput = useSignal<HTMLInputElement>();
    const currentCity = city.value;
    const cityInput = useSignal<HTMLInputElement>();
    const currentWeight = weight.value;
    const weightInput = useSignal<HTMLInputElement>();

    return (
      <form aria-label="Profile" {...scopeAttributes(attributes)} class={className} style={style}>
        <label>
          Name{" "}
          <input
            ref={nameInput}
            value={modelText.shown(nameInput.value, currentName, { trim: true })}
            onInput$={(_, element) => (name.value = modelText.read(element, { trim: true }))}
          />
        </label>
        <label>
          City{" "}
          <input
            ref={cityInput}
            value={modelText.shown(cityInput.value, currentCity, { lazy: true })}
            onChange$={(_, element) => (city.value = modelText.read(element, { lazy: true }))}
          />
        </label>
        <label>
          Weight{" "}
          <input
            ref={weightInput}
            value={modelText.shown(weightInput.value, currentWeight, { number: true })}
            onInput$={(_, element) => (weight.value = modelText.read(element, { number: true }))}
          />
        </label>
        <output>
          [{name.value}] from {city.value}, {weight.value + 1}
        </output>
      </form>
    );
  },
);

/**
 * A text control's `v-model` as Vue's `vModelText` runs it: `read` is what the control's text
 * writes, trimmed with `trim` and cast with `number` as `looseToNumber` does; `shown` is the text
 * the control shows for a value, which keeps the person's own text while it is focused and
 * reads as the value (`trim`, `lazy`), or casts to it.
 */
const modelText = {
  read<T>(element: HTMLInputElement | HTMLTextAreaElement, modifiers: TextModifiers): T {
    const text = modifiers.trim ? element.value.trim() : element.value;
    const number = Number.parseFloat(text);
    // The state's type: where the text is no number, Vue writes the text, as here.
    return (modifiers.number && !Number.isNaN(number) ? number : text) as T;
  },
  shown(
    element: HTMLInputElement | HTMLTextAreaElement | undefined,
    value: unknown,
    modifiers: TextModifiers,
  ): string {
    const text = value == null ? "" : String(value);
    if (!element || element.value === text) return text;
    if (element === document.activeElement && element.type !== "range") {
      if (modifiers.lazy || (modifiers.trim && element.value.trim() === text)) {
        return element.value;
      }
    }
    if (modifiers.number && this.read(element, modifiers) === value) return element.value;
    return text;
  },
};

/** The modifiers of a text control's `v-model`. */
interface TextModifiers {
  trim?: boolean;
  lazy?: boolean;
  number?: boolean;
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
