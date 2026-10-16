import { CountKey } from "./Counter";
import {
  type CSSProperties,
  type ClassList,
  component$,
  useContext,
  useSignal,
} from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style }) => {
    const none = useSignal(0);
    const count = useContext(CountKey, (provided?) => (provided === undefined ? none : provided));

    return (
      <output class={className} style={style}>
        Count: {count.value}
      </output>
    );
  },
);
