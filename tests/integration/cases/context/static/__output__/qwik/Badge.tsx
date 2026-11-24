import { ThemeKey } from "./ThemeProvider";
import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useContext,
} from "@qwik.dev/core";

export default component$<
  { text: string } & Omit<PropsOf<"span">, "text" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ text, class: className, style, ...attributes }) => {
  const theme = useContext(ThemeKey, (provided?) => provided);

  return (
    <span class={["badge", theme?.accent, className]} style={style} {...attributes}>
      {text} in {theme?.label ?? "no theme"}
    </span>
  );
});
