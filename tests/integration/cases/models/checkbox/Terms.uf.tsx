import { ref } from "unframework";

export default function Terms() {
  const agreed = ref(false);
  return (
    <section aria-label="Terms">
      <label>
        <input type="checkbox" v-model={agreed.value} /> I agree
      </label>
      <output>{agreed.value ? "Agreed" : "Not agreed"}</output>
      <button type="button" onClick={() => (agreed.value = !agreed.value)}>
        Toggle
      </button>
    </section>
  );
}
