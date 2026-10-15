import { type CSSProperties, useRef, useState } from "react";

export interface BillingAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Billing({ className, style }: BillingAttributes) {
  const [plan, setPlan] = useState("monthly");
  const planRef = useRef(plan);

  return (
    <fieldset className={className} style={style}>
      <legend>Billing</legend>
      <label>
        <input
          type="radio"
          name="plan"
          value="monthly"
          defaultChecked={plan === "monthly"}
          ref={(element) => {
            if (!element) return undefined;
            setChecked(element, plan, plan === "monthly");
            const stop = listen(element, "change", () => {
              planRef.current = "monthly";
              setPlan(planRef.current);
            });
            return () => {
              stop();
            };
          }}
        />{" "}
        Monthly
      </label>
      <label>
        <input
          type="radio"
          name="plan"
          value="yearly"
          defaultChecked={plan === "yearly"}
          ref={(element) => {
            if (!element) return undefined;
            setChecked(element, plan, plan === "yearly");
            const stop = listen(element, "change", () => {
              planRef.current = "yearly";
              setPlan(planRef.current);
            });
            return () => {
              stop();
            };
          }}
        />{" "}
        Yearly
      </label>
      <output>Plan: {plan}</output>
      <button
        type="button"
        onClick={() => {
          planRef.current = "monthly";
          setPlan(planRef.current);
        }}
      >
        Reset
      </button>
    </fieldset>
  );
}

/**
 * Listens to a DOM event natively, where React's synthetic event would not keep the DOM's
 * semantics, and gives back what stops it: the cleanup a ref callback returns.
 */
function listen<K extends keyof HTMLElementEventMap>(
  element: EventTarget | null,
  type: K,
  listener: (event: HTMLElementEventMap[K]) => void,
  options?: AddEventListenerOptions,
): () => void {
  element?.addEventListener(type, listener as EventListener, options);
  return () => element?.removeEventListener(type, listener as EventListener, options);
}

/**
 * Sets a checkbox's or a radio's `checked` when its model's value changed since the element last
 * showed it, as Vue's `v-model` does: a render between the control's `input` and its `change`
 * keeps what was clicked.
 */
function setChecked(element: HTMLInputElement, value: unknown, checked: boolean): void {
  if (checkedValues.has(element) && checkedValues.get(element) === value) return;
  checkedValues.set(element, value);
  element.checked = checked;
}

const checkedValues = new WeakMap<HTMLInputElement, unknown>();
