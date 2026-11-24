import { type ComponentPropsWithRef, createContext } from "react";

export type ThemeAttributes = Omit<ComponentPropsWithRef<"p">, "children">;

export const ThemeKey = createContext<string | undefined>(undefined);

export default function Theme({ className, style, ...attributes }: ThemeAttributes) {
  return (
    <p className={className} style={style} {...attributes}>
      Theme
    </p>
  );
}
