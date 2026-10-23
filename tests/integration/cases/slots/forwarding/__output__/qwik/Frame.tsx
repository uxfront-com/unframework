import Box from "./Box";
import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type QRL,
  component$,
} from "@qwik.dev/core";

export interface FrameSlots {
  title$?: QRL<() => JSXOutput>;
}

export default component$<
  { label: string } & FrameSlots & { class?: ClassList; style?: CSSProperties }
>(({ label, title$, class: className, style, ...attributes }) => {
  return (
    <section
      class={["frame", className]}
      aria-label={label}
      {...scopeAttributes(attributes)}
      style={style}
    >
      <Box title$={title$} />
    </section>
  );
});

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
