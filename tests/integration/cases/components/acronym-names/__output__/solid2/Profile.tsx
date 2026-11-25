import Avatar from "./Avatar";
import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";

export default function Profile(
  props: Omit<ComponentProps<"div">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const [picked, setPicked] = createState("none");

  return (
    <div {...props}>
      <Avatar imageURL="/a.png" userID={7} onPickedURL={(url) => setPicked(url)} />
      <output>Picked: {picked()}</output>
    </div>
  );
}
