import { ref } from "unframework";

export default function ColourList() {
  const colour = ref("none");
  return (
    <section aria-label="Colours">
      <select
        size="3"
        aria-label="Colour"
        onChange={(event) => (colour.value = (event.currentTarget as HTMLSelectElement).value)}
      >
        <option value="red">Red</option>
        <option value="green">Green</option>
        <option value="blue">Blue</option>
      </select>
      <output>Picked: {colour.value}</output>
    </section>
  );
}
