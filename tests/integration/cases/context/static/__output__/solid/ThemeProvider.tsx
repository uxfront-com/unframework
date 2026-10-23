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
      <section
        aria-label="Themed"
        class={props.class}
        style={props.style}
        {...scopeAttributes(props)}
      >
        <Badge text="New" />
      </section>
    </ThemeKey.Provider>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
