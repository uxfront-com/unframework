import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type PropsOf,
  type QRL,
  Slot,
  component$,
} from "@qwik.dev/core";

export interface CardSlots {
  title$?: QRL<() => JSXOutput>;
}

export default component$<
  { label: string } & CardSlots &
    Omit<PropsOf<"section">, "label" | "title$" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ label, title$, class: className, style, ...attributes }) => {
  return (
    <section class={["card", className]} aria-label={label} style={style} {...attributes}>
      <>{title$ ? <header class="title">{title$?.()}</header> : null}</>
      {false ? (
        <div class="body">
          <Slot />
        </div>
      ) : (
        <p>Empty card</p>
      )}
    </section>
  );
});
