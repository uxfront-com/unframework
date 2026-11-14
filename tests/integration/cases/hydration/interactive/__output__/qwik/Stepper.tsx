import {
  $,
  type CSSProperties,
  type ClassList,
  type QRL,
  component$,
  useSignal,
} from "@qwik.dev/core";

export interface StepperProps {
  start?: number;
}

export interface StepperEvents {
  onChange$?: QRL<(value: number) => void>;
}

export default component$<
  StepperProps & StepperEvents & { class?: ClassList; style?: CSSProperties }
>(({ start = 0, onChange$, class: className, style, ...attributes }) => {
  const count = useSignal(start);

  const add = $(() => {
    count.value += 1;
    onChange$?.(count.value);
  });

  return (
    <div class={["stepper", className]} {...scopeAttributes(attributes)} style={style}>
      <output>{count.value}</output>
      <button type="button" onClick$={add}>
        Add one
      </button>
    </div>
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
