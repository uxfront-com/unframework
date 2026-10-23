import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";
import { button } from "virtual:styleframe";
import "virtual:styleframe.css";

export default component$<
  { label: string; size?: "sm" | "lg"; tone?: "neutral" | "primary" } & {
    class?: ClassList;
    style?: CSSProperties;
  }
>(({ label, size, tone, class: className, style, ...attributes }) => {
  return (
    <button
      type="button"
      class={[button({ size, tone }), className]}
      {...scopeAttributes(attributes)}
      style={style}
    >
      {label}
    </button>
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
