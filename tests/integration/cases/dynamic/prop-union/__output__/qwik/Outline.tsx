import Heading from "./Heading";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    return (
      <main {...scopeAttributes(attributes)} class={className} style={style}>
        <Heading tag="h1" text="Guide" />
        <Heading tag="h2" text="Setup" />
        <Heading tag="h3" text="Requirements" />
      </main>
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
