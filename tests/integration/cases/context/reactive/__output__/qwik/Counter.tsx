import Display from "./Display";
import {
  type CSSProperties,
  type ClassList,
  type Signal,
  component$,
  createContextId,
  useContextProvider,
  useSignal,
} from "@qwik.dev/core";

export const CountKey = createContextId<Signal<number>>("uf.count");

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style }) => {
    const count = useSignal(1);

    useContextProvider(CountKey, count);

    return (
      <section aria-label="Counter" class={className} style={style}>
        <Display />
        <button type="button" onClick$={() => (count.value += 1)}>
          Add one
        </button>
      </section>
    );
  },
);
