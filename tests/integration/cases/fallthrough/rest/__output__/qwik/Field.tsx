import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  type Signal,
  component$,
} from "@qwik.dev/core";

export default component$<
  { label: string } & Omit<PropsOf<"input">, "label" | "class" | "style" | "ref"> & {
      class?: ClassList;
      style?: CSSProperties;
      ref?: Signal<Element | undefined>;
    }
>(({ label, class: className, style, ref, ...attributes }) => {
  return (
    <label class="field" {...scopeAttributes(attributes)} ref={ref}>
      {label}{" "}
      <input
        name={label.toLowerCase()}
        class={className}
        style={style}
        {...restAttributes(attributes)}
      />
    </label>
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

/** What the consumer passes, but the scope attributes its root keeps. */
function restAttributes(attributes: PropsOf<"input">): PropsOf<"input"> {
  return Object.fromEntries(
    Object.entries(attributes).filter(([key]) => !key.startsWith("data-uf-")),
  );
}
