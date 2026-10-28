import Select from "./Select";
import { type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

type Size = "s" | "m" | "l";

const sizes: Size[] = ["s", "m", "l"];

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    const size = useSignal<Size>("m");

    return (
      <section aria-label="Size" {...scopeAttributes(attributes)} class={className} style={style}>
        <Select
          label="Size"
          options={sizes}
          value={size.value}
          onValueChange$={(value) => (size.value = value)}
        />
        <output>Chosen: {size.value}</output>
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
