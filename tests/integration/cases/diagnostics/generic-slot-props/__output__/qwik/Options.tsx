import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type PropsOf,
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
  }: { options: T[] } & OptionsSlots<T> &
    Omit<PropsOf<"ul">, "options" | "option$" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }) => {
    return (
      <ul class={className} style={style} {...attributes}>
        {options.map((option) => (
          <li key={option.value}>{option$?.({ option })}</li>
        ))}
      </ul>
    );
  },
);
