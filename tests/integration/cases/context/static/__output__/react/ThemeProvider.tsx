import Badge from "./Badge";
import { type CSSProperties, createContext, useState } from "react";

export interface Theme {
  accent: string;
  label: string;
}

export interface ThemeProviderAttributes {
  className?: string;
  style?: CSSProperties;
}

export const ThemeKey = createContext<Theme | undefined>(undefined);

export default function ThemeProvider({ className, style }: ThemeProviderAttributes) {
  const [themeValue] = useState({ accent: "teal", label: "Teal" });

  return (
    <ThemeKey value={themeValue}>
      <section aria-label="Themed" className={className} style={style}>
        <Badge text="New" />
      </section>
    </ThemeKey>
  );
}
