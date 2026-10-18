import { ThemeKey } from "./ThemeProvider";
import { type CSSProperties, type ClassList, component$, useContext } from "@qwik.dev/core";

export default component$<{ text: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ text, class: className, style }) => {
    const theme = useContext(ThemeKey, (provided?) => provided);

    return (
      <span class={["badge", theme?.accent, className]} style={style}>
        {text} in {theme?.label ?? "no theme"}
      </span>
    );
  },
);
