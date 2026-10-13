import {
  $,
  type CSSProperties,
  type ClassList,
  type QRL,
  component$,
  useComputed$,
  useSignal,
} from "@qwik.dev/core";

export interface PriceRangeModels {
  min?: number;
  onMinChange$?: QRL<(min: number) => void>;
  max?: number;
  onMaxChange$?: QRL<(max: number) => void>;
}

export default component$<
  { label: string } & PriceRangeModels & { class?: ClassList; style?: CSSProperties }
>(({ label, min: minProp, onMinChange$, max: maxProp, onMaxChange$, class: className, style }) => {
  const minLocal = useSignal<number>(0);
  const min = useComputed$(() => (minProp === undefined ? minLocal.value : minProp));

  const setMin = $(async (next: number) => {
    if (minProp === undefined) minLocal.value = next;
    await onMinChange$?.(next);
  });

  const maxLocal = useSignal<number>(100);
  const max = useComputed$(() => (maxProp === undefined ? maxLocal.value : maxProp));

  const setMax = $(async (next: number) => {
    if (maxProp === undefined) maxLocal.value = next;
    await onMaxChange$?.(next);
  });

  const widen = $(async () => {
    await setMin(min.value - 10);
    await setMax(max.value + 10);
  });

  return (
    <fieldset class={className} style={style}>
      <legend>{label}</legend>
      <p>
        From {min.value} to {max.value}
      </p>
      <button type="button" onClick$={widen}>
        Widen
      </button>
    </fieldset>
  );
});
