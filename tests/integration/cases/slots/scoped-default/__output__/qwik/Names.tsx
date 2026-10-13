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
>(({ names, default$, class: className, style }) => {
  return (
    <ul aria-label="Names" class={className} style={style}>
      {names.map((item) => (
        <li key={item}>{default$?.({ item })}</li>
      ))}
    </ul>
  );
});
