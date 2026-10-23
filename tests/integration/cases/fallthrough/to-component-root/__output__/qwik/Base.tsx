import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ text: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ text, class: className, style, ...attributes }) => {
    return (
      <button
        type="button"
        class={["base", className]}
        {...scopeAttributes(attributes)}
        style={style}
      >
        {text}
      </button>
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
