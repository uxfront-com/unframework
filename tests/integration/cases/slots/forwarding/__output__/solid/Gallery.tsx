import Frame from "./Frame";
import type { ComponentProps, JSX } from "solid-js";

export default function Gallery(
  props: Omit<ComponentProps<"div">, "style"> & { style?: JSX.CSSProperties },
) {
  return (
    <div {...props}>
      <Frame label="Filled" title={"Sunset"}>
        <p>Taken at dusk.</p>
      </Frame>
      <Frame label="Empty" />
    </div>
  );
}
