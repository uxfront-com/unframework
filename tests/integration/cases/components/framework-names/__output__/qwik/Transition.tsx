import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ step: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ step, class: className, style, ...attributes }) => {
    return (
      <p class={["step", className]} {...scopeAttributes(attributes)} style={style}>
        Step: {step}
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
