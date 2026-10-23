import { type JSX, createSignal } from "solid-js";

export default function Billing(props: { class?: string; style?: JSX.CSSProperties }) {
  const [plan, setPlan] = createSignal("monthly");

  return (
    <fieldset class={props.class} style={props.style} {...scopeAttributes(props)}>
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
