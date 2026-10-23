import { type CSSProperties, type ClassList, component$, useStyles$ } from "@qwik.dev/core";
import styles from "./Stack.uf.tsx.css?inline";

export default component$<
  { gap: string; accent: string } & { class?: ClassList; style?: CSSProperties }
>(({ gap, accent, class: className, style, ...attributes }) => {
  useStyles$(styles);

  return (
    <ul
      class={["stack", className]}
      style={{ "--gap": gap, "--accent": accent, ...style }}
      data-uf-e3a22111=""
      {...scopeAttributes(attributes)}
    >
      <li class="item" data-uf-e3a22111="">
        One
      </li>
      <li class="item" data-uf-e3a22111="">
        Two
      </li>
      <li class="item" data-uf-e3a22111="">
        Three
      </li>
    </ul>
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
