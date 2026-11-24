import Primary from "./Primary";
import type { ComponentProps, JSX } from "@solidjs/web";

export default function Toolbar(
  props: Omit<ComponentProps<"div">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  return (
    <div role="toolbar" aria-label="Actions" {...props}>
      <Primary text="Save" class="wide" />
    </div>
  );
}
