import { useMediaQuery } from "./useMediaQuery";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    const { matches: wide } = useMediaQuery("(min-width: 1px)");
    const { matches: tiny } = useMediaQuery("(max-width: 1px)");

    return (
      <section
        class={["layout", className]}
        aria-label="Layout"
        {...scopeAttributes(attributes)}
        style={style}
      >
        <p role="status">{wide.value ? "Wide layout" : "Narrow layout"}</p>
        <p>{tiny.value ? "Tiny screen" : "Not a tiny screen"}</p>
      </section>
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
