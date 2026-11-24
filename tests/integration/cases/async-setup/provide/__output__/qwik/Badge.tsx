import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  createContextId,
  useContext,
} from "@qwik.dev/core";

export const ToneKey = createContextId<string>("uf.tone");

export default component$<
  Omit<PropsOf<"span">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  const tone = useContext(ToneKey, (provided?) => (provided === undefined ? "plain" : provided));

  return (
    <span class={["badge", className]} style={style} {...attributes}>
      Tone: {tone}
    </span>
  );
});
