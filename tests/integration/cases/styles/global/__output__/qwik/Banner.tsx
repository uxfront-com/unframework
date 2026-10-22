import Hint from "./Hint";
import { type CSSProperties, type ClassList, component$, useStyles$ } from "@qwik.dev/core";
import styles from "./Banner.uf.tsx.css?inline";

export default component$<{ tip: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ tip, class: className, style, ...attributes }) => {
    useStyles$(styles);

    return (
      <div
        class={["banner", className]}
        data-uf-e25060c2=""
        {...scopeAttributes(attributes)}
        style={style}
      >
        <Hint text={tip} data-uf-e25060c2="" />
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
