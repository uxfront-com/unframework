import { type CSSProperties, createContext } from "react";

export interface ThemeAttributes {
  className?: string;
  style?: CSSProperties;
}

export const ThemeKey = createContext<string | undefined>(undefined);

export default function Theme({ className, style, ...attributes }: ThemeAttributes) {
  return (
    <p className={className} style={style} {...scopeAttributes(attributes)}>
      Theme
    </p>
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
