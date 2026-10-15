import { type JSX, createSignal } from "solid-js";

export default function Billing(props: { class?: string; style?: JSX.CSSProperties }) {
  const [plan, setPlan] = createSignal("monthly");

  return (
    <fieldset class={props.class} style={props.style}>
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
