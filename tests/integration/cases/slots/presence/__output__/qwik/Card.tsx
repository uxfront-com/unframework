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
>(({ label, title$, class: className, style, ...attributes }) => {
  return (
    <section
      class={["card", className]}
      aria-label={label}
      {...scopeAttributes(attributes)}
      style={style}
    >
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
