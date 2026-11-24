import { CountKey } from "./Counter";
import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useContext,
  useSignal,
} from "@qwik.dev/core";

export default component$<
  Omit<PropsOf<"output">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  const none = useSignal(0);
  const count = useContext(CountKey, (provided?) => (provided === undefined ? none : provided));

  return (
    <output class={className} style={style} {...attributes}>
      Count: {count.value}
    </output>
  );
});
