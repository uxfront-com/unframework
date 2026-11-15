import Rows from "./Rows";
import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type QRL,
  component$,
} from "@qwik.dev/core";

export interface WrapperSlots {
  row$?: QRL<() => JSXOutput>;
}

export default component$<WrapperSlots & { class?: ClassList; style?: CSSProperties }>(
  ({ row$, class: className, style, ...attributes }) => {
    return (
      <section
        class={["wrapper", className]}
        aria-label="Rows"
        {...scopeAttributes(attributes)}
        style={style}
      >
        <Rows row$={row$} />
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
