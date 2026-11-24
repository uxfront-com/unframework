import Button from "./Button";
import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useStyles$,
} from "@qwik.dev/core";
import styles from "./Toolbar.uf.tsx.css?inline";

export default component$<
  Omit<PropsOf<"div">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  useStyles$(styles);

  return (
    <div
      role="toolbar"
      aria-label="Actions"
      class={["toolbar", className]}
      data-uf-a33d603f=""
      style={style}
      {...attributes}
    >
      <Button text="Save" data-uf-a33d603f="" />
      <Button text="Cancel" data-uf-a33d603f="" />
    </div>
  );
});
