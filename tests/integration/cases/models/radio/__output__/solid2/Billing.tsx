import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";

export default function Billing(
  props: Omit<ComponentProps<"fieldset">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const [plan, setPlan] = createState("monthly");

  return (
    <fieldset {...props}>
      <legend>Billing</legend>
      <label>
        <input
          type="radio"
          name="plan"
          value="monthly"
          checked={plan() === "monthly"}
          onChange={() => setPlan("monthly")}
        />{" "}
        Monthly
      </label>
      <label>
        <input
          type="radio"
          name="plan"
          value="yearly"
          checked={plan() === "yearly"}
          onChange={() => setPlan("yearly")}
        />{" "}
        Yearly
      </label>
      <output>Plan: {plan()}</output>
      <button type="button" onClick={() => setPlan("monthly")}>
        Reset
      </button>
    </fieldset>
  );
}
