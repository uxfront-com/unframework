import type { CSSProperties, ComponentPropsWithRef } from "react";

interface HintAttributes {
  id: string;
  style?: string;
}

export interface HintProps {
  text: string;
  attrs: HintAttributes;
}

export type HintAttributes_1 = Omit<ComponentPropsWithRef<"small">, "text" | "attrs" | "children">;

export default function Hint({
  text,
  attrs,
  className,
  style,
  ...attributes
}: HintProps & HintAttributes_1) {
  return (
    <small
      id={attrs.id}
      style={{ ...styleObject(attrs.style), ...style }}
      className={className}
      {...attributes}
    >
      {text}
    </small>
  );
}

/** A style bound to a value as React's style takes it: a declaration list becomes an object. */
function styleObject(style: object | string | null | undefined): CSSProperties | undefined {
  if (typeof style !== "string") return (style ?? undefined) as CSSProperties | undefined;
  const object: Record<string, string> = {};
  for (const declaration of style.replace(/\/\*[^]*?\*\//g, "").split(/;(?![^(]*\))/g)) {
    const [property, value] = declaration.split(/:([^]+)/);
    const key = property!.trim();
    // A property is a custom property or a CSS identifier: anything else would reach the markup.
    if (value === undefined || !/^(?:--[^\s"'<>&;:]+|-?[A-Za-z_][\w-]*)$/.test(key)) continue;
    // A standard name is case-insensitive, as the browser reads it: COLOR is color.
    const camel = key
      .toLowerCase()
      .replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
    object[key.startsWith("--") ? key : camel] = value.trim();
  }
  return object as CSSProperties;
}
