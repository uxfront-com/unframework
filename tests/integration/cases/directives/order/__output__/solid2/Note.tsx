import { vNote } from "./vNote";
import type { ComponentProps, JSX } from "@solidjs/web";

export default function Note(
  props: Omit<ComponentProps<"em">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  return (
    <em data-name="note" ref={vNote(() => "note")} {...props}>
      Note
    </em>
  );
}
