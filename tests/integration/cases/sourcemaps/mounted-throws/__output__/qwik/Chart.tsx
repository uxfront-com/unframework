import { type CSSProperties, type ClassList, component$, useVisibleTask$ } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    useVisibleTask$(
      () => {
        throw new Error("The chart could not start");
      },
      { strategy: "document-ready" },
    );

    return (
      <p {...scopeAttributes(attributes)} class={className} style={style}>
        Chart
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
