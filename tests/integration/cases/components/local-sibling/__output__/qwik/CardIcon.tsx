import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export const CardIcon = component$<
  { symbol: string } & Omit<PropsOf<"span">, "symbol" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ symbol, class: className, style, ...attributes }) => {
  return (
    <span class={["icon", className]} aria-hidden="true" style={style} {...attributes}>
      {symbol}
    </span>
  );
});
