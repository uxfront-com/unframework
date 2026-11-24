import {
  $,
  type CSSProperties,
  type ClassList,
  type PropsOf,
  type QRL,
  component$,
  useComputed$,
  useSignal,
} from "@qwik.dev/core";

export interface SelectProps<T extends string> {
  label: string;
  options: readonly T[];
}

export interface SelectModels<T extends string> {
  value: T;
  onValueChange$?: QRL<(value: T) => void>;
}

export default component$(
  <T extends string>({
    label,
    options,
    value: valueProp,
    onValueChange$,
    class: className,
    style,
    ...attributes
  }: SelectProps<T> &
    SelectModels<T> &
    Omit<PropsOf<"label">, "label" | "options" | "value" | "onValueChange$" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }) => {
    const valueLocal = useSignal<T>();
    const value = useComputed$(() => (valueProp === undefined ? valueLocal.value : valueProp));

    const setValue = $(async (next: T) => {
      if (valueProp === undefined) valueLocal.value = next;
      await onValueChange$?.(next);
    });

    const currentValue = value.value;

    return (
      <label class={className} style={style} {...attributes}>
        {label}{" "}
        <select onChange$={(_, element) => setValue(element.value as T)}>
          {options.map((option) => (
            <option
              key={option}
              selected={currentValue === option}
              value={option}
            >{`${option ?? ""}`}</option>
          ))}
        </select>
      </label>
    );
  },
);
