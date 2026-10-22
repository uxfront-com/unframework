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
  ({ title, class: className, style, ...attributes }) => {
    const depth = useContext(DepthKey, (provided?) => (provided === undefined ? 0 : provided));

    useContextProvider(DepthKey, depth + 1);

    return (
      <section aria-label={title} {...scopeAttributes(attributes)} class={className} style={style}>
        <h2>
          {title} at depth {depth}
        </h2>
        <Slot />
      </section>
    );
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
