import {
  $,
  type CSSProperties,
  type ClassList,
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
  }: SelectProps<T> & SelectModels<T> & { class?: ClassList; style?: CSSProperties }) => {
    const valueLocal = useSignal<T>();
    const value = useComputed$(() => (valueProp === undefined ? valueLocal.value : valueProp));

    const setValue = $(async (next: T) => {
      if (valueProp === undefined) valueLocal.value = next;
      await onValueChange$?.(next);
    });

    const currentValue = value.value;

    return (
      <label {...scopeAttributes(attributes)} class={className} style={style}>
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
