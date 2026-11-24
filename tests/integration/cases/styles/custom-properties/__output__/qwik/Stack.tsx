import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useStyles$,
} from "@qwik.dev/core";
import styles from "./Stack.uf.tsx.css?inline";

export default component$<
  { gap: string; accent: string } & Omit<PropsOf<"ul">, "gap" | "accent" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ gap, accent, class: className, style, ...attributes }) => {
  useStyles$(styles);

  return (
    <ul
      class={["stack", className]}
      style={{ "--gap": gap, "--accent": accent, ...style }}
      data-uf-e3a22111=""
      {...attributes}
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
