import { LocaleKey } from "./LocaleProvider";
import { type CSSProperties, type ClassList, component$, useContext } from "@qwik.dev/core";

export default component$<{ name: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ name, class: className, style, ...attributes }) => {
    const locale = useContext(LocaleKey, (provided?) => (provided === undefined ? "en" : provided));

    return (
      <p {...scopeAttributes(attributes)} class={className} style={style}>
        {locale === "pt" ? "Olá" : "Hello"}, {name} ({locale})
      </p>
    );
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
