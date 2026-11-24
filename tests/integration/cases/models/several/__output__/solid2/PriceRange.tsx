import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface PriceRangeModels {
  min?: number;
  onMinChange?: (value: number) => void;
  max?: number;
  onMaxChange?: (value: number) => void;
}

export default function PriceRange(
  props: { label: string } & PriceRangeModels &
    Omit<ComponentProps<"fieldset">, "label" | "min" | "max" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "label", "min", "onMinChange", "max", "onMaxChange");

  const [localMin, setLocalMin] = createState<number>(0);
  const min = () => (props.min === undefined ? localMin() : props.min);

  function setMin(next: number) {
    setLocalMin(next);
    props.onMinChange?.(next);
  }

  const [localMax, setLocalMax] = createState<number>(100);
  const max = () => (props.max === undefined ? localMax() : props.max);

  function setMax(next: number) {
    setLocalMax(next);
    props.onMaxChange?.(next);
  }

  function widen() {
    setMin(min() - 10);
    setMax(max() + 10);
  }

  return (
    <fieldset {...others}>
      <legend>{props.label}</legend>
      <p>
        From {min()} to {max()}
      </p>
      <button type="button" onClick={widen}>
        Widen
      </button>
    </fieldset>
  );
}
