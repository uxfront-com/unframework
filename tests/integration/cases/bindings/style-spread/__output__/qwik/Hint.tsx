import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

interface HintAttributes {
  id: string;
  style?: string;
}

export interface HintProps {
  text: string;
  attrs: HintAttributes;
}

export default component$<
  HintProps &
    Omit<PropsOf<"small">, "text" | "attrs" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ text, attrs, class: className, style, ...attributes }) => {
  return (
    <small
      id={attrs.id}
      style={{ ...styleObject(attrs.style), ...style }}
      class={className}
      {...attributes}
    >
      {text}
    </small>
  );
});

/**
 * A style bound to a value as an object, which a merge spreads: a declaration list splits as
 * Vue's parseStringStyle splits it, with camel-case keys.
 */
function styleObject(style: object | string | null | undefined): Record<string, string> {
  if (typeof style !== "string") return { ...style };
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
  return object;
}
