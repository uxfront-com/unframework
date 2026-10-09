import { ref } from "unframework";

export default function SizePicker() {
  const size = ref("m");
  return (
    <section aria-label="Size">
      <label>
        Size{" "}
        <select v-model={size.value}>
          <option value="s">Small</option>
          <option value="m">Medium</option>
          <option value="l">Large</option>
        </select>
      </label>
      <output>Chosen: {size.value}</output>
      <button type="button" onClick={() => (size.value = "l")}>
        Largest
      </button>
    </section>
  );
}
