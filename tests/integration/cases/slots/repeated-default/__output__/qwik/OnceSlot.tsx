import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type PropsOf,
  type QRL,
  component$,
} from "@qwik.dev/core";

export interface OnceSlotSlots {
  text$?: QRL<(props: { label: string }) => JSXOutput>;
}

export default component$<
  { label: string } & OnceSlotSlots &
    Omit<PropsOf<"span">, "label" | "text$" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ label, text$, class: className, style, ...attributes }) => {
  return (
    <span class={["once-slot", className]} style={style} {...attributes}>
      {text$?.({ label })}
    </span>
  );
});
