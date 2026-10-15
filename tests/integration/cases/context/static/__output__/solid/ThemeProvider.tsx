import Badge from "./Badge";
import { type JSX, createContext } from "solid-js";

export interface Theme {
  accent: string;
  label: string;
}

export const ThemeKey = createContext<Theme>();

export default function ThemeProvider(props: { class?: string; style?: JSX.CSSProperties }) {
  return (
    <ThemeKey.Provider value={{ accent: "teal", label: "Teal" }}>
      <section aria-label="Themed" class={props.class} style={props.style}>
        <Badge text="New" />
      </section>
    </ThemeKey.Provider>
  );
}
