import {
  $,
  type CSSProperties,
  type ClassList,
  type PropsOf,
  type QRL,
  component$,
} from "@qwik.dev/core";

export interface ChipEvents {
  onPick$?: QRL<(label: string) => void>;
}

export default component$<
  { label: string } & ChipEvents &
    Omit<PropsOf<"button">, "label" | "onPick$" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ label, onPick$, class: className, style, onClick$, ...attributes }) => {
  return (
    <button
      type="button"
      class={["chip", className]}
      onClick$={[$(() => onPick$?.(label)), onClick$]}
      style={style}
      {...attributes}
    >
      {label}
    </button>
  );
});
