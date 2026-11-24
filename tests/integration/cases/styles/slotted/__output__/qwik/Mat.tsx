import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  Slot,
  component$,
  useStyles$,
} from "@qwik.dev/core";
import styles from "./Mat.uf.tsx.css?inline";

export default component$<
  Omit<PropsOf<"div">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  useStyles$(styles);

  return (
    <div class={["mat", className]} data-uf-09929c4a="" style={style} {...attributes}>
      <Slot />
    </div>
  );
});
