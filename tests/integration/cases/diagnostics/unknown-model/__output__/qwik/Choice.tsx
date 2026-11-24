import {
  $,
  type CSSProperties,
  type ClassList,
  type PropsOf,
  type QRL,
  component$,
  useComputed$,
  useSignal,
} from "@qwik.dev/core";

export interface ChoiceModels {
  picked?: string;
  onPickedChange$?: QRL<(picked: string) => void>;
}

export const Choice = component$<
  ChoiceModels &
    Omit<PropsOf<"button">, "picked" | "onPickedChange$" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ picked: pickedProp, onPickedChange$, class: className, style, onClick$, ...attributes }) => {
  const pickedLocal = useSignal<string>("");
  const picked = useComputed$(() => (pickedProp === undefined ? pickedLocal.value : pickedProp));

  const setPicked = $(async (next: string) => {
    if (pickedProp === undefined) pickedLocal.value = next;
    await onPickedChange$?.(next);
  });

  return (
    <button
      type="button"
      onClick$={[$(() => setPicked("yes")), onClick$]}
      class={className}
      style={style}
      {...attributes}
    >
      Yes ({picked.value})
    </button>
  );
});
