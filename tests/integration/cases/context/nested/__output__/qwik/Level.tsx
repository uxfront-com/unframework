import {
  type CSSProperties,
  type ClassList,
  Slot,
  component$,
  createContextId,
  useContext,
  useContextProvider,
} from "@qwik.dev/core";

export const DepthKey = createContextId<number>("uf.depth");

export default component$<{ title: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ title, class: className, style }) => {
    const depth = useContext(DepthKey, (provided?) => (provided === undefined ? 0 : provided));

    useContextProvider(DepthKey, depth + 1);

    return (
      <section aria-label={title} class={className} style={style}>
        <h2>
          {title} at depth {depth}
        </h2>
        <Slot />
      </section>
    );
  },
);
