import Frame from "./Frame";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    return (
      <div {...scopeAttributes(attributes)} class={className} style={style}>
        <Frame label="Card" wide={false} title$={() => "Sunset"} />
        <Frame label="Panel" wide={true} title$={() => "Dawn"} />
        <Frame label="Empty" wide={true} />
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
