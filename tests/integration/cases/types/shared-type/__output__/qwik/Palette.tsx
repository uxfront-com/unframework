import Swatch from "./Swatch";
import type { Tone } from "./types";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export type { Tone } from "./types";

export default component$<{ tone: Tone } & { class?: ClassList; style?: CSSProperties }>(
  ({ tone, class: className, style, ...attributes }) => {
    return (
      <div class={["palette", className]} {...scopeAttributes(attributes)} style={style}>
        <Swatch tone={tone} />
      </div>
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
