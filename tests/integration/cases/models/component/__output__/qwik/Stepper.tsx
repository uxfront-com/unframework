import {
  $,
  type CSSProperties,
  type ClassList,
  type QRL,
  component$,
  useComputed$,
  useSignal,
} from "@qwik.dev/core";

export interface StepperModels {
  value?: number;
  onValueChange$?: QRL<(value: number) => void>;
}

export default component$<
  { label: string } & StepperModels & { class?: ClassList; style?: CSSProperties }
>(({ label, value: valueProp, onValueChange$, class: className, style }) => {
  const valueLocal = useSignal<number>(0);
  const value = useComputed$(() => (valueProp === undefined ? valueLocal.value : valueProp));

  const setValue = $(async (next: number) => {
    if (valueProp === undefined) valueLocal.value = next;
    await onValueChange$?.(next);
  });

  return (
    <div class={["stepper", className]} style={style}>
      <button
        type="button"
        aria-label={`Fewer ${label}`}
        onClick$={() => setValue(value.value - 1)}
      >
        -
      </button>
      <span>
        {label}: {value.value}
      </span>
      <button type="button" aria-label={`More ${label}`} onClick$={() => setValue(value.value + 1)}>
        +
      </button>
    </div>
  );
});
