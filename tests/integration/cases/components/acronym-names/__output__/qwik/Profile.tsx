import Avatar from "./Avatar";
import { type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    const picked = useSignal("none");

    return (
      <div {...scopeAttributes(attributes)} class={className} style={style}>
        <Avatar imageURL="/a.png" userID={7} onPickedURL$={(url) => (picked.value = url)} />
        <output>Picked: {picked.value}</output>
      </div>
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
