import { type CSSProperties, useRef, useState } from "react";

export interface BillingAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Billing({ className, style, ...attributes }: BillingAttributes) {
  const [plan, setPlan] = useState("monthly");
  const planRef = useRef(plan);

  return (
    <fieldset className={className} style={style} {...scopeAttributes(attributes)}>
      <legend>Billing</legend>
      <label>
        <input
          type="radio"
          name="plan"
          value="monthly"
          checked={plan === "monthly"}
          onChange={() => {
            planRef.current = "monthly";
            setPlan(planRef.current);
          }}
        />{" "}
        Monthly
      </label>
      <label>
        <input
          type="radio"
          name="plan"
          value="yearly"
          checked={plan === "yearly"}
          onChange={() => {
            planRef.current = "yearly";
            setPlan(planRef.current);
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
