import type { ComponentProps, JSX } from "@solidjs/web";
import { createContext } from "solid-js";

export const ThemeKey = createContext<string | null>(null);

export default function Theme(
  props: Omit<ComponentProps<"p">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  return <p {...props}>Theme</p>;
}
