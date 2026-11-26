import { ThemeKey } from "./ThemeProvider";
import { cx } from "./_unframework/cx";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit, useContext } from "solid-js";

export default function Badge(
  props: { text: string } & Omit<ComponentProps<"span">, "text" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "text", "class");

  const theme = useContext(ThemeKey) ?? undefined;

  return (
    <span class={cx("badge", theme?.accent, props.class)} {...others}>
      {props.text} in {theme?.label ?? "no theme"}
    </span>
  );
}
