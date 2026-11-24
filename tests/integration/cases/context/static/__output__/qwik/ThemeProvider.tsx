import Badge from "./Badge";
import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  createContextId,
  useContextProvider,
} from "@qwik.dev/core";

export interface Theme {
  accent: string;
  label: string;
}

export const ThemeKey = createContextId<Theme>("uf.theme");

export default component$<
  Omit<PropsOf<"section">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  useContextProvider(ThemeKey, { accent: "teal", label: "Teal" });

  return (
    <section aria-label="Themed" class={className} style={style} {...attributes}>
      <Badge text="New" />
    </section>
  );
});
