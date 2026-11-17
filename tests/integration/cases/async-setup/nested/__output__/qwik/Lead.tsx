import Member from "./Member";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ id: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ id, class: className, style, ...attributes }) => {
    return (
      <>
        <Member id={id} {...scopeAttributes(attributes)} class={className} style={style} />
      </>
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
