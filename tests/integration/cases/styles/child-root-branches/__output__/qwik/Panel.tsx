import Heading from "./Heading";
import Status from "./Status";
import { type CSSProperties, type ClassList, component$, useStyles$ } from "@qwik.dev/core";
import styles from "./Panel.uf.tsx.css?inline";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    useStyles$(styles);

    return (
      <section
        class={["panel", className]}
        data-uf-34db6205=""
        {...scopeAttributes(attributes)}
        style={style}
      >
        <Heading big={true} text="Release" data-uf-34db6205="" />
        <Heading big={false} text="Notes" data-uf-34db6205="" />
        <Status busy={false} text="Save" data-uf-34db6205="" />
        <Status busy={true} text="Save" data-uf-34db6205="" />
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
