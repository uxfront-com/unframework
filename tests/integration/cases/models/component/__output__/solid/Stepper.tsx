import { type JSX, createSignal } from "solid-js";

export interface StepperModels {
  value?: number;
  onValueChange?: (value: number) => void;
}

export default function Stepper(
  props: { label: string } & StepperModels & { class?: string; style?: JSX.CSSProperties },
) {
  const [localValue, setLocalValue] = createSignal<number>(0);
  const value = () => (props.value === undefined ? localValue() : props.value);

  function setValue(next: number) {
    setLocalValue(next);
    props.onValueChange?.(next);
  }

  return (
    <div
      class={props.class ? `stepper ${props.class}` : "stepper"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <button
        type="button"
        aria-label={`Fewer ${props.label}`}
        onClick={() => setValue(value() - 1)}
      >
        -
      </button>
      <span>
        {props.label}: {value()}
      </span>
      <button
        type="button"
        aria-label={`More ${props.label}`}
        onClick={() => setValue(value() + 1)}
      >
        +
      </button>
    </div>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
