import Badge from "./Badge";
import {
  type CSSProperties,
  type ClassList,
  component$,
  createContextId,
  useContextProvider,
} from "@qwik.dev/core";

export interface Theme {
  accent: string;
  label: string;
}

export const ThemeKey = createContextId<Theme>("uf.theme");

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    useContextProvider(ThemeKey, { accent: "teal", label: "Teal" });

    return (
      <section aria-label="Themed" {...scopeAttributes(attributes)} class={className} style={style}>
        <Badge text="New" />
      </section>
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
