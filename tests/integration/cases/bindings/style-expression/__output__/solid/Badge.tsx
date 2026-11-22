import { type ComponentProps, type JSX, splitProps } from "solid-js";

export interface BadgeProps {
  label: string;
  tone?: string;
}

export default function Badge(
  props: BadgeProps &
    Omit<ComponentProps<"span">, "label" | "tone" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["label", "tone", "class", "style"]);

  return (
    <span
      class={props.class ? `badge ${props.class}` : "badge"}
      style={{ ...styleProperties(props.tone), ...props.style }}
      {...others}
    >
      {props.label}
    </span>
  );
}

/** A style bound to a value as an object of CSS properties. */
function styleProperties(
  style: object | string | null | undefined,
): Record<string, string> | undefined {
  if (style === null || style === undefined) return undefined;
  // A property is a custom property or a CSS identifier: Solid's server writes keys as they are.
  const PROPERTY = /^(?:--[^\s"'<>&;:]+|-?[A-Za-z_][\w-]*)$/;
  const properties: Record<string, string> = {};
  if (typeof style === "string") {
    for (const declaration of style.replace(/\/\*[^]*?\*\//g, "").split(/;(?![^(]*\))/g)) {
      const [property, value] = declaration.split(/:([^]+)/);
      const key = property!.trim();
      // A standard name is case-insensitive, as the browser reads it: COLOR is color.
      if (value !== undefined && PROPERTY.test(key)) {
        properties[key.startsWith("--") ? key : key.toLowerCase()] = value.trim();
      }
    }
    return properties;
  }
  for (const [key, value] of Object.entries(style)) {
    if (value === null || value === undefined || !PROPERTY.test(key)) continue;
    const kebab = key.replace(/[A-Z]/g, (letter) => "-" + letter.toLowerCase());
    properties[key.startsWith("--") ? key : kebab] = String(value);
  }
  return properties;
}
