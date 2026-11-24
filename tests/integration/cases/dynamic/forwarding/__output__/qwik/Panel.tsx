import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type PropsOf,
  type QRL,
  component$,
} from "@qwik.dev/core";

export interface PanelSlots {
  title$?: QRL<() => JSXOutput>;
}

export default component$<
  PanelSlots &
    Omit<PropsOf<"div">, "title$" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ title$, class: className, style, ...attributes }) => {
  return (
    <div class={["panel", className]} style={style} {...attributes}>
      <h4>{title$?.() ?? "Untitled"}</h4>
    </div>
  );
});
