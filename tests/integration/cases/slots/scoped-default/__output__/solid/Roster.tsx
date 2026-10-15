import Names from "./Names";
import type { JSX } from "solid-js";

export default function Roster(
  props: { names: string[] } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <Names
      names={props.names}
      children={({ item }) => <b>{item}!</b>}
      class={props.class}
      style={props.style}
    />
  );
}
