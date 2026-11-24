import { scopeAttributes } from "./_unframework/scopeAttributes";
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
