import { nextTick } from "./_unframework/nextTick";
import {
  $,
  type CSSProperties,
  type ClassList,
  type PropsOf,
  type QRL,
  component$,
  useSignal,
} from "@qwik.dev/core";

export interface SaveDraftEvents {
  onSaved$?: QRL<(attempt: number, status: string) => void>;
}

export default component$<
  SaveDraftEvents &
    Omit<PropsOf<"section">, "onSaved$" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ onSaved$, class: className, style, ...attributes }) => {
  const status = useSignal("Not saved");
  const attempts = useSignal(0);

  const save = $(async () => {
    status.value = "Saving";
    attempts.value += 1;
    await Promise.resolve();
    status.value = "Checking";
    await nextTick();
    status.value = `Saved, attempt ${attempts.value}`;
    onSaved$?.(attempts.value, status.value);
  });

  return (
    <section class={["save-draft", className]} aria-label="Draft" style={style} {...attributes}>
      <p role="status">{status.value}</p>
      <button type="button" onClick$={save}>
        Save the draft
      </button>
    </section>
  );
});
