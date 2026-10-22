import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type QRL,
  Slot,
  component$,
  useStyles$,
} from "@qwik.dev/core";
import styles from "./Frame.uf.tsx.css?inline";

export interface FrameSlots {
  label$?: QRL<(props: { text: string }) => JSXOutput>;
}

export default component$<FrameSlots & { class?: ClassList; style?: CSSProperties }>(
  ({ label$, class: className, style, ...attributes }) => {
    useStyles$(styles);

    return (
      <figure
        class={["frame", className]}
        data-uf-9dc516fd=""
        {...scopeAttributes(attributes)}
        style={style}
      >
        <Slot />
        {label$?.({ text: "Harbour at dusk" })}
      </figure>
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
