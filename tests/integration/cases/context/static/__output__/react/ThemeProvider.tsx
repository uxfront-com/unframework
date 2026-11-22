import Badge from "./Badge";
import { type ComponentPropsWithRef, createContext, useState } from "react";

export interface Theme {
  accent: string;
  label: string;
}

export type ThemeProviderAttributes = Omit<ComponentPropsWithRef<"section">, "children">;

export const ThemeKey = createContext<Theme | undefined>(undefined);

export default function ThemeProvider({
  className,
  style,
  ...attributes
}: ThemeProviderAttributes) {
  const [themeValue] = useState({ accent: "teal", label: "Teal" });

  return (
    <ThemeKey value={themeValue}>
      <section aria-label="Themed" className={className} style={style} {...attributes}>
        <Badge text="New" />
      </section>
    </ThemeKey>
  );
}
