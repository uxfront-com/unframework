/**
 * A style bound to a value as an object of CSS properties (ADR-0065), which a merge spreads: a
 * declaration list splits as Vue's parseStringStyle splits it, and an object's camel-case keys
 * are written in kebab case, as the template writes its declarations.
 */
export function styleObject(
  style: object | string | null | undefined,
): Record<string, string | null | undefined> {
  const properties: Record<string, string | null | undefined> = {};
  if (typeof style === "string") {
    for (const declaration of style.replace(/\/\*[^]*?\*\//g, "").split(/;(?![^(]*\))/g)) {
      const [property, value] = declaration.split(/:([^]+)/);
      const key = property!.trim();
      // A property is a custom property or a CSS identifier: anything else would reach the markup.
      if (value !== undefined && /^(?:--[^\s"'<>&;:]+|-?[A-Za-z_][\w-]*)$/.test(key))
        properties[key.startsWith("--") ? key : key.toLowerCase()] = value.trim();
    }
    return properties;
  }
  for (const [key, value] of Object.entries(style ?? {})) {
    const kebab = key.replace(/[A-Z]/g, (letter) => "-" + letter.toLowerCase());
    properties[key.startsWith("--") ? key : kebab] =
      value === null || value === undefined ? value : String(value);
  }
  return properties;
}
