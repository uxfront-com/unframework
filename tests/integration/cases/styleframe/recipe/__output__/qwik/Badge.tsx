import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";
import { badge } from "virtual:styleframe";
import "virtual:styleframe.css";

export default component$<{ label: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ label, class: className, style, ...attributes }) => {
    return (
      <span class={[badge(), className]} {...scopeAttributes(attributes)} style={style}>
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
