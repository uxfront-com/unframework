import { ref } from "unframework";

export default function Billing() {
  const plan = ref("monthly");
  return (
    <fieldset>
      <legend>Billing</legend>
      <label>
        <input type="radio" name="plan" value="monthly" v-model={plan.value} /> Monthly
      </label>
      <label>
        <input type="radio" name="plan" value="yearly" v-model={plan.value} /> Yearly
      </label>
      <output>Plan: {plan.value}</output>
      <button type="button" onClick={() => (plan.value = "monthly")}>
        Reset
      </button>
    </fieldset>
  );
}
