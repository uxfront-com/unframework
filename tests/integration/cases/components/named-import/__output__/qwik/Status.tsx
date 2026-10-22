import { Badge } from "./Badge";
import { Pill as Tag } from "./Pill";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ state: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ state, class: className, style, ...attributes }) => {
    return (
      <p class={["status", className]} {...scopeAttributes(attributes)} style={style}>
        <Badge text="Build" />
        <Tag text={state} />
      </p>
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
