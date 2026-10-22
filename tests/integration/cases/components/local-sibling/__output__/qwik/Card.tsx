import { CardIcon } from "./CardIcon";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ title: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ title, class: className, style, ...attributes }) => {
    return (
      <div class={["card", className]} {...scopeAttributes_1(attributes)} style={style}>
        <CardIcon symbol="+" />
        <h3>{title}</h3>
        <CardIcon symbol="-" />
      </div>
    );
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes_1(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
