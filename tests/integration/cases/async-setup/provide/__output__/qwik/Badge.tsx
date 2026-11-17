import {
  type CSSProperties,
  type ClassList,
  component$,
  createContextId,
  useContext,
} from "@qwik.dev/core";

export const ToneKey = createContextId<string>("uf.tone");

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    const tone = useContext(ToneKey, (provided?) => (provided === undefined ? "plain" : provided));

    return (
      <span class={["badge", className]} {...scopeAttributes(attributes)} style={style}>
        Tone: {tone}
      </span>
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
