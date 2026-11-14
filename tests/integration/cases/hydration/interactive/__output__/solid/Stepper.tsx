import { type JSX, createSignal, mergeProps, untrack } from "solid-js";

export interface StepperProps {
  start?: number;
}

export interface StepperEvents {
  onChange?: (value: number) => void;
}

export default function Stepper(
  rawProps: StepperProps & StepperEvents & { class?: string; style?: JSX.CSSProperties },
) {
  const props = mergeProps({ start: 0 } satisfies Partial<StepperProps>, rawProps);
  const [count, setCount] = createSignal(untrack(() => props.start));

  function add() {
    setCount(count() + 1);
    props.onChange?.(count());
  }

  return (
    <div
      class={props.class ? `stepper ${props.class}` : "stepper"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <output>{count()}</output>
      <button type="button" onClick={add}>
        Add one
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
