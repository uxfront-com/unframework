import { ThemeKey } from "./ThemeProvider";
import { cx } from "./_unframework/cx";
import { type ComponentProps, type JSX, splitProps, useContext } from "solid-js";

export default function Badge(
  props: { text: string } & Omit<ComponentProps<"span">, "text" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["text", "class"]);

  const theme = useContext(ThemeKey);

  return (
    <span class={cx("badge", theme?.accent, props.class)} {...others}>
      {props.text} in {theme?.label ?? "no theme"}
    </span>
  );
}
