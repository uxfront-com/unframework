import Level from "./Level";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    return (
      <>
        <Level title="Book" {...scopeAttributes(attributes)} class={className} style={style}>
          <Level title="Part">
            <Level title="Chapter" />
          </Level>
          <Level title="Appendix" />
        </Level>
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
