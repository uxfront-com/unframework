import { modelText } from "./_unframework/modelText";
import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useSignal,
} from "@qwik.dev/core";

export default component$<
  Omit<PropsOf<"form">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
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
    <form aria-label="Profile" class={className} style={style} {...attributes}>
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
});
