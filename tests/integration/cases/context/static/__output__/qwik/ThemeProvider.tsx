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
  ({ class: className, style }) => {
    useContextProvider(ThemeKey, { accent: "teal", label: "Teal" });

    return (
      <section aria-label="Themed" class={className} style={style}>
        <Badge text="New" />
      </section>
    );
  },
);
