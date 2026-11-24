import Primary from "./Primary";
import type { ComponentProps, JSX } from "solid-js";

export default function Toolbar(
  props: Omit<ComponentProps<"div">, "style"> & { style?: JSX.CSSProperties },
) {
  return (
    <div role="toolbar" aria-label="Actions" {...props}>
      <Primary text="Save" class="wide" />
    </div>
  );
}
