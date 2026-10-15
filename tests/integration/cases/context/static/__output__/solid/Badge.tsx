import { ThemeKey } from "./ThemeProvider";
import { type JSX, useContext } from "solid-js";

export default function Badge(
  props: { text: string } & { class?: string; style?: JSX.CSSProperties },
) {
  const theme = useContext(ThemeKey);

  return (
    <span class={cx("badge", theme?.accent, props.class)} style={props.style}>
      {props.text} in {theme?.label ?? "no theme"}
    </span>
  );
}

/** Joins class names: strings as they are, and the names of an object's truthy entries. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") names.push(part);
    else if (part && typeof part === "object") {
      for (const [name, on] of Object.entries(part)) if (on) names.push(name);
    }
  }
  return names.join(" ");
}
