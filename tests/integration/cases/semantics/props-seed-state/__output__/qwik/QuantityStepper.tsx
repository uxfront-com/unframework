import { type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export interface QuantityStepperProps {
  initial: number;
  label: string;
}

export default component$<QuantityStepperProps & { class?: ClassList; style?: CSSProperties }>(
  ({ initial, label, class: className, style, ...attributes }) => {
    const quantity = useSignal(initial);

    return (
      <div
        class={["quantity-stepper", className]}
        role="group"
        aria-label={label}
        {...scopeAttributes(attributes)}
        style={style}
      >
        <output>{quantity.value}</output>
        <button type="button" aria-label={`Increase ${label}`} onClick$={() => quantity.value++}>
          +
        </button>
      </div>
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
