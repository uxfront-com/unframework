import { type QRL, component$ } from "@qwik.dev/core";

export interface SaveButtonEvents {
  onSave$?: QRL<() => void>;
}

export const SaveButton = component$<SaveButtonEvents>(({ onSave$ }) => {
  return (
    <button type="button" onClick$={() => onSave$?.()}>
      Save
    </button>
  );
});
