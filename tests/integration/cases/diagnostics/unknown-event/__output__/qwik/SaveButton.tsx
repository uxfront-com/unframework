import {
  $,
  type CSSProperties,
  type ClassList,
  type PropsOf,
  type QRL,
  component$,
} from "@qwik.dev/core";

export interface SaveButtonEvents {
  onSave$?: QRL<() => void>;
}

export const SaveButton = component$<
  SaveButtonEvents &
    Omit<PropsOf<"button">, "onSave$" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ onSave$, class: className, style, onClick$, ...attributes }) => {
  return (
    <button
      type="button"
      onClick$={[$(() => onSave$?.()), onClick$]}
      class={className}
      style={style}
      {...attributes}
    >
      Save
    </button>
  );
});
