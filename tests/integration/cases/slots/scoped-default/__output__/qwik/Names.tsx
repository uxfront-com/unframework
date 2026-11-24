import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type PropsOf,
  type QRL,
  component$,
} from "@qwik.dev/core";

export interface NamesSlots {
  default$?: QRL<(props: { item: string }) => JSXOutput>;
}

export default component$<
  { names: string[] } & NamesSlots &
    Omit<PropsOf<"ul">, "names" | "default$" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ names, default$, class: className, style, ...attributes }) => {
  return (
    <ul aria-label="Names" class={className} style={style} {...attributes}>
      {names.map((item) => (
        <li key={item}>{default$?.({ item })}</li>
      ))}
    </ul>
  );
});
