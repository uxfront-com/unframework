import { modelText } from "./_unframework/modelText";
import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useSignal,
} from "@qwik.dev/core";

export default component$<
  Omit<PropsOf<"section">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  const count = useSignal(2);
  const volume = useSignal(5);

  const currentCount = count.value;
  const countInput = useSignal<HTMLInputElement>();
  const currentVolume = volume.value;
  const volumeInput = useSignal<HTMLInputElement>();

  return (
    <section aria-label="Order" class={className} style={style} {...attributes}>
      <input
        type="number"
        aria-label="Count"
        min="0"
        ref={countInput}
        value={modelText.shown(countInput.value, currentCount, { number: true })}
        onInput$={(_, element) => (count.value = modelText.read(element, { number: true }))}
      />
      <input
        type="range"
        aria-label="Volume"
        min="0"
        max="10"
        ref={volumeInput}
        value={modelText.shown(volumeInput.value, currentVolume, { number: true })}
        onInput$={(_, element) => (volume.value = modelText.read(element, { number: true }))}
      />
      <output>
        Next: {count.value + 1}, volume {volume.value + 1}
      </output>
      <button type="button" onClick$={() => (count.value = 10)}>
        Ten
      </button>
    </section>
  );
});
