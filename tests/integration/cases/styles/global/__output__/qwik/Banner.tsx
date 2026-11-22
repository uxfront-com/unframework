import Hint from "./Hint";
import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useStyles$,
} from "@qwik.dev/core";
import styles from "./Banner.uf.tsx.css?inline";

export default component$<
  { tip: string } & Omit<PropsOf<"div">, "tip" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ tip, class: className, style, ...attributes }) => {
  useStyles$(styles);

  return (
    <div class={["banner", className]} data-uf-e25060c2="" style={style} {...attributes}>
      <Hint text={tip} data-uf-e25060c2="" />
    </div>
  );
});
