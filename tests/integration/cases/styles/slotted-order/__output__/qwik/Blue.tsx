import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  Slot,
  component$,
  useStyles$,
} from "@qwik.dev/core";
import styles from "./Blue.uf.tsx.css?inline";

export default component$<
  Omit<PropsOf<"div">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  useStyles$(styles);

  return (
    <div class={["blue", className]} data-uf-721c504a="" style={style} {...attributes}>
      <Slot />
    </div>
  );
});
