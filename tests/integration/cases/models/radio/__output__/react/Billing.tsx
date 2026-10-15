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
