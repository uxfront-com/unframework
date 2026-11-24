import Card from "./Card";
import Panel from "./Panel";
import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type PropsOf,
  type QRL,
  component$,
} from "@qwik.dev/core";

export interface FrameSlots {
  title$?: QRL<() => JSXOutput>;
}

export default component$<
  { label: string; wide: boolean } & FrameSlots &
    Omit<PropsOf<"section">, "label" | "wide" | "title$" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ label, wide, title$, class: className, style, ...attributes }) => {
  const Tag = wide ? Panel : Card;

  return (
    <section class={["frame", className]} aria-label={label} style={style} {...attributes}>
      <Tag title$={title$} />
    </section>
  );
});
