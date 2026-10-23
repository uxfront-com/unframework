import Avatar from "./Avatar";
import { type JSX, createSignal } from "solid-js";

export default function Profile(props: { class?: string; style?: JSX.CSSProperties }) {
  const [picked, setPicked] = createSignal("none");

  return (
    <div class={props.class} style={props.style} {...scopeAttributes(props)}>
      <Avatar imageURL="/a.png" userID={7} onPickedURL={(url) => setPicked(url)} />
      <output>Picked: {picked()}</output>
    </div>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
