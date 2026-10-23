import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

interface HintAttributes {
  id: string;
  style?: string;
}

export interface HintProps {
  text: string;
  attrs: HintAttributes;
}

export default component$<HintProps & { class?: ClassList; style?: CSSProperties }>(
  ({ text, attrs, class: className, style, ...attributes }) => {
    return (
      <small
        id={attrs.id}
        style={{ ...styleObject(attrs.style), ...style }}
        {...scopeAttributes(attributes)}
        class={className}
      >
        {text}
      </small>
    );
  },
);

/**
 * A style bound to a value as an object, which a merge spreads: a declaration list splits as
 * Vue's parseStringStyle splits it, with camel-case keys.
 */
function styleObject(style: object | string | null | undefined): Record<string, string> {
  if (typeof style !== "string") return { ...style };
  const object: Record<string, string> = {};
  for (const declaration of style.replace(/\/\*[^]*?\*\//g, "").split(/;(?![^(]*\))/g)) {
    const [property, value] = declaration.split(/:([^]+)/);
    if (value === undefined) continue;
    const key = property!.trim();
    const camel = key.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
    object[key.startsWith("--") ? key : camel] = value.trim();
  }
  return object;
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
