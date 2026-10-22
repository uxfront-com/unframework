import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export const CardIcon = component$<
  { symbol: string } & { class?: ClassList; style?: CSSProperties }
>(({ symbol, class: className, style, ...attributes }) => {
  return (
    <span
      class={["icon", className]}
      aria-hidden="true"
      {...scopeAttributes(attributes)}
      style={style}
    >
      {symbol}
    </span>
  );
});

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
