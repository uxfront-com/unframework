import Avatar from "./Avatar";
import { type JSX, createSignal } from "solid-js";

export default function Profile(props: { class?: string; style?: JSX.CSSProperties }) {
  const [picked, setPicked] = createSignal("none");

  return (
    <div class={props.class} style={props.style}>
      <Avatar imageURL="/a.png" userID={7} onPickedURL={(url) => setPicked(url)} />
      <output>Picked: {picked()}</output>
    </div>
  );
}
