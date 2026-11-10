import type { Sized, Toned } from "./types";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

type ChipProps = Sized & Toned & { label: string };

export default component$<ChipProps & { class?: ClassList; style?: CSSProperties }>(
  ({ size, tone = "neutral", label, class: className, style, ...attributes }) => {
    return (
      <span
        class={[`chip chip-${size} chip-${tone}`, className]}
        {...scopeAttributes(attributes)}
        style={style}
      >
        {label}
      </span>
    );
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
