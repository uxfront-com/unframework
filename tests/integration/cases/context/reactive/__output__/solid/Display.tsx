import { CountKey } from "./Counter";
import { type JSX, createSignal, useContext } from "solid-js";

export default function Display(props: { class?: string; style?: JSX.CSSProperties }) {
  const [none] = createSignal(0);
  const count = useContext(CountKey) ?? {
    get value() {
      return none();
    },
  };

  return (
    <output class={props.class} style={props.style}>
      Count: {count.value}
    </output>
  );
}
