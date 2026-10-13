import { type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style }) => {
    const plan = useSignal("monthly");

    const currentPlan = plan.value;

    return (
      <fieldset class={className} style={style}>
        <legend>Billing</legend>
        <label>
          <input
            type="radio"
            name="plan"
            value="monthly"
            checked={currentPlan === "monthly"}
            onChange$={() => (plan.value = "monthly")}
          />{" "}
          Monthly
        </label>
        <label>
          <input
            type="radio"
            name="plan"
            value="yearly"
            checked={currentPlan === "yearly"}
            onChange$={() => (plan.value = "yearly")}
          />{" "}
          Yearly
        </label>
        <output>Plan: {plan.value}</output>
        <button type="button" onClick$={() => (plan.value = "monthly")}>
          Reset
        </button>
      </fieldset>
    );
  },
);
