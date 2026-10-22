import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type QRL,
  component$,
} from "@qwik.dev/core";

export interface NamesSlots {
  default$?: QRL<(props: { item: string }) => JSXOutput>;
}

export default component$<
  { names: string[] } & NamesSlots & { class?: ClassList; style?: CSSProperties }
>(({ names, default$, class: className, style, ...attributes }) => {
  return (
    <ul aria-label="Names" {...scopeAttributes(attributes)} class={className} style={style}>
      {names.map((item) => (
        <li key={item}>{default$?.({ item })}</li>
      ))}
    </ul>
  );
});

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
