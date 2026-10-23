import type { JSX } from "solid-js";

export interface BadgeProps {
  label: string;
  tone?: string;
}

export default function Badge(props: BadgeProps & { class?: string; style?: JSX.CSSProperties }) {
  return (
    <span
      class={props.class ? `badge ${props.class}` : "badge"}
      style={{ ...styleProperties(props.tone), ...props.style }}
      {...scopeAttributes(props)}
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
  const properties: Record<string, string> = {};
  if (typeof style === "string") {
    for (const declaration of style.replace(/\/\*[^]*?\*\//g, "").split(/;(?![^(]*\))/g)) {
      const [property, value] = declaration.split(/:([^]+)/);
      if (value !== undefined) properties[property!.trim()] = value.trim();
    }
    return properties;
  }
  for (const [key, value] of Object.entries(style)) {
    if (value === null || value === undefined) continue;
    const kebab = key.replace(/[A-Z]/g, (letter) => "-" + letter.toLowerCase());
    properties[key.startsWith("--") ? key : kebab] = String(value);
  }
  return properties;
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
