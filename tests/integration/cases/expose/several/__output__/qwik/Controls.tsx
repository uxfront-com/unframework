import Counter from "./Counter";
import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useSignal,
} from "@qwik.dev/core";

export default component$<
  Omit<PropsOf<"div">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  const counter = useSignal<{ increment(): void; reset(): void }>();

  return (
    <div class={["controls", className]} style={style} {...attributes}>
      <Counter ref={counter} start={10} />
      <button type="button" onClick$={() => counter.value?.increment()}>
        More
      </button>
      <button type="button" onClick$={() => counter.value?.reset()}>
        Reset
      </button>
    </div>
  );
});
