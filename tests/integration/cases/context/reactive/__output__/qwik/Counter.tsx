import Display from "./Display";
import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  type Signal,
  component$,
  createContextId,
  useContextProvider,
  useSignal,
} from "@qwik.dev/core";

export const CountKey = createContextId<Signal<number>>("uf.count");

export default component$<
  Omit<PropsOf<"section">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  const count = useSignal(1);

  useContextProvider(CountKey, count);

  return (
    <section aria-label="Counter" class={className} style={style} {...attributes}>
      <Display />
      <button type="button" onClick$={() => (count.value += 1)}>
        Add one
      </button>
    </section>
  );
});
