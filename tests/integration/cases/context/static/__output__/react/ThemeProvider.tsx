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

export default function ThemeProvider({
  className,
  style,
  ...attributes
}: ThemeProviderAttributes) {
  const [themeValue] = useState({ accent: "teal", label: "Teal" });

  return (
    <ThemeKey value={themeValue}>
      <section
        aria-label="Themed"
        className={className}
        style={style}
        {...scopeAttributes(attributes)}
      >
        <Badge text="New" />
      </section>
    </ThemeKey>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
