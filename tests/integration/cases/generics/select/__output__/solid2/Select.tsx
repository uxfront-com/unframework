import { KeyedFor } from "./_unframework/KeyedFor";
import { selectOptions } from "./_unframework/selectOptions";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface SelectProps<T extends string> {
  label: string;
  options: readonly T[];
}

export interface SelectModels<T extends string> {
  value: T;
  onValueChange?: (value: T) => void;
}

export default function Select<T extends string>(
  props: SelectProps<T> &
    SelectModels<T> &
    Omit<ComponentProps<"label">, "label" | "options" | "value" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "label", "options", "value", "onValueChange");

  const value = () => props.value;

  function setValue(next: T) {
    props.onValueChange?.(next);
  }

  return (
    <label {...others}>
      {props.label}{" "}
      <select
        onChange={(event) => setValue(event.currentTarget.value as T)}
        ref={selectOptions(value)}
      >
        <KeyedFor each={props.options} by={(option) => option}>
          {(option) => (
            <option value={option.value} selected={value() === option.value}>
              {option.value}
            </option>
          )}
        </KeyedFor>
      </select>
    </label>
  );
}
