import { vNote } from "./vNote";
import type { ComponentProps, JSX } from "solid-js";

export default function Note(
  props: Omit<ComponentProps<"em">, "style"> & { style?: JSX.CSSProperties },
) {
  return (
    <em data-name="note" ref={vNote(() => "note")} {...props}>
      Note
    </em>
  );
}
