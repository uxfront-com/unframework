import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useStyles$,
} from "@qwik.dev/core";
import styles from "./Progress.uf.tsx.css?inline";

export default component$<
  { label: string } & Omit<PropsOf<"div">, "label" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ label, class: className, style, ...attributes }) => {
  useStyles$(styles);

  return (
    <div class={["progress", className]} data-uf-0738d8af="" style={style} {...attributes}>
      <span class="dot" data-uf-0738d8af="" />
      <span data-uf-0738d8af="">{label}</span>
    </div>
  );
});
