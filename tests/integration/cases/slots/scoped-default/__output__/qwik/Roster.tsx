import Names from "./Names";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ names: string[] } & { class?: ClassList; style?: CSSProperties }>(
  ({ names, class: className, style, ...attributes }) => {
    return (
      <>
        <Names
          names={names}
          {...scopeAttributes(attributes)}
          default$={({ item }) => <b>{item}!</b>}
          class={className}
          style={style}
        />
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
