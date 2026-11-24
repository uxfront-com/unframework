import Avatar from "./Avatar";
import { type ComponentProps, type JSX, createSignal } from "solid-js";

export default function Profile(
  props: Omit<ComponentProps<"div">, "style"> & { style?: JSX.CSSProperties },
) {
  const [picked, setPicked] = createSignal("none");

  return (
    <div {...props}>
      <Avatar imageURL="/a.png" userID={7} onPickedURL={(url) => setPicked(url)} />
      <output>Picked: {picked()}</output>
    </div>
  );
}
