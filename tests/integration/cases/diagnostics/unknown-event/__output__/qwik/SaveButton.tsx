import { type CSSProperties, type ClassList, type QRL, component$ } from "@qwik.dev/core";

export interface SaveButtonEvents {
  onSave$?: QRL<() => void>;
}

export const SaveButton = component$<
  SaveButtonEvents & { class?: ClassList; style?: CSSProperties }
>(({ onSave$, class: className, style }) => {
  return (
    <button type="button" onClick$={() => onSave$?.()} class={className} style={style}>
      Save
    </button>
  );
});
