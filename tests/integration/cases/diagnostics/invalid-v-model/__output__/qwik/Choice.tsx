import {
  $,
  type CSSProperties,
  type ClassList,
  type QRL,
  component$,
  useComputed$,
  useSignal,
} from "@qwik.dev/core";

export interface ChoiceModels {
  picked?: string;
  onPickedChange$?: QRL<(picked: string) => void>;
}

export const Choice = component$<ChoiceModels & { class?: ClassList; style?: CSSProperties }>(
  ({ picked: pickedProp, onPickedChange$, class: className, style }) => {
    const pickedLocal = useSignal<string>("");
    const picked = useComputed$(() => (pickedProp === undefined ? pickedLocal.value : pickedProp));

    const setPicked = $(async (next: string) => {
      if (pickedProp === undefined) pickedLocal.value = next;
      await onPickedChange$?.(next);
    });

    return (
      <button type="button" onClick$={() => setPicked("yes")} class={className} style={style}>
        Yes ({picked.value})
      </button>
    );
  },
);
