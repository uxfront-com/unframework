import { type ComponentProps, type JSX, createContext } from "solid-js";

export const ThemeKey = createContext<string>();

export default function Theme(
  props: Omit<ComponentProps<"p">, "style"> & { style?: JSX.CSSProperties },
) {
  return <p {...props}>Theme</p>;
}
