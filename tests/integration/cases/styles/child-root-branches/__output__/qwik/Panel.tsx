import Heading from "./Heading";
import Status from "./Status";
import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useStyles$,
} from "@qwik.dev/core";
import styles from "./Panel.uf.tsx.css?inline";

export default component$<
  Omit<PropsOf<"section">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  useStyles$(styles);

  return (
    <section class={["panel", className]} data-uf-34db6205="" style={style} {...attributes}>
      <Heading big={true} text="Release" data-uf-34db6205="" />
      <Heading big={false} text="Notes" data-uf-34db6205="" />
      <Status busy={false} text="Save" data-uf-34db6205="" />
      <Status busy={true} text="Save" data-uf-34db6205="" />
    </section>
  );
});
