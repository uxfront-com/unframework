import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export const CardIcon = component$<
  { symbol: string } & { class?: ClassList; style?: CSSProperties }
>(({ symbol, class: className, style }) => {
  return (
    <span class={["icon", className]} aria-hidden="true" style={style}>
      {symbol}
    </span>
  );
});
