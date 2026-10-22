import { ThemeKey } from "./ThemeProvider";
import { type CSSProperties, type ClassList, component$, useContext } from "@qwik.dev/core";

export default component$<{ text: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ text, class: className, style, ...attributes }) => {
    const theme = useContext(ThemeKey, (provided?) => provided);

    return (
      <span
        class={["badge", theme?.accent, className]}
        {...scopeAttributes(attributes)}
        style={style}
      >
        {text} in {theme?.label ?? "no theme"}
      </span>
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
