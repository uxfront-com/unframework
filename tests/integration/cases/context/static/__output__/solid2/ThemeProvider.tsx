import Badge from "./Badge";
import type { ComponentProps, JSX } from "@solidjs/web";
import { createContext } from "solid-js";

export interface Theme {
  accent: string;
  label: string;
}

export const ThemeKey = createContext<Theme | null>(null);

export default function ThemeProvider(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  return (
    <ThemeKey value={{ accent: "teal", label: "Teal" }}>
      <section aria-label="Themed" {...props}>
        <Badge text="New" />
      </section>
    </ThemeKey>
  );
}
