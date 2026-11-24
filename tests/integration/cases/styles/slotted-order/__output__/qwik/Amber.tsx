import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  Slot,
  component$,
  useStyles$,
} from "@qwik.dev/core";
import styles from "./Amber.uf.tsx.css?inline";

export default component$<
  Omit<PropsOf<"div">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  useStyles$(styles);

  return (
    <div class={["amber", className]} data-uf-c97301b3="" style={style} {...attributes}>
      <Slot />
    </div>
  );
});
