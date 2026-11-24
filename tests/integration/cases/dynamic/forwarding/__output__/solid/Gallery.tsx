import Frame from "./Frame";
import type { ComponentProps, JSX } from "solid-js";

export default function Gallery(
  props: Omit<ComponentProps<"div">, "style"> & { style?: JSX.CSSProperties },
) {
  return (
    <div {...props}>
      <Frame label="Card" wide={false} title={"Sunset"} />
      <Frame label="Panel" wide={true} title={"Dawn"} />
      <Frame label="Empty" wide={true} />
    </div>
  );
}
