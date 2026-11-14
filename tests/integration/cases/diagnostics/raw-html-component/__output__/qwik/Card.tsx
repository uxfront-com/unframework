import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export const Card = component$<{ heading: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ heading, class: className, style, ...attributes }) => {
    return (
      <section class={["card", className]} {...scopeAttributes(attributes)} style={style}>
        <h2>{heading}</h2>
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
