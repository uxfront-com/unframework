import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type QRL,
  Slot,
  component$,
} from "@qwik.dev/core";

export interface CardSlots {
  title$?: QRL<() => JSXOutput>;
}

export default component$<
  { label: string } & CardSlots & { class?: ClassList; style?: CSSProperties }
>(({ label, title$, class: className, style }) => {
  return (
    <section class={["card", className]} aria-label={label} style={style}>
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
