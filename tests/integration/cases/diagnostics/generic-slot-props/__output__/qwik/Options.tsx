import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type QRL,
  component$,
} from "@qwik.dev/core";

export interface OptionsSlots<T extends { value: string }> {
  option$?: QRL<(props: { option: T }) => JSXOutput>;
}

export default component$(
  <T extends { value: string }>({
    options,
    option$,
    class: className,
    style,
    ...attributes
  }: { options: T[] } & OptionsSlots<T> & { class?: ClassList; style?: CSSProperties }) => {
    return (
      <ul {...scopeAttributes(attributes)} class={className} style={style}>
        {options.map((option) => (
          <li key={option.value}>{option$?.({ option })}</li>
        ))}
      </ul>
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
