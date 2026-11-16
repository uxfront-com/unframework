import { defineSlots, ref } from "@uxfront/unframework";
import type { Element } from "@uxfront/unframework";

// A child that renders its scoped `option` slot once per option of its own state, keyed by id,
// and renames, reverses and removes options without a render of its parent.
export default function Picker() {
  const slots = defineSlots<{ option?(props: { option: { id: string; label: string } }): Element }>();
  const options = ref([
    { id: "x", label: "Xray" },
    { id: "y", label: "Yankee" },
  ]);

  return (
    <div class="picker">
      <ul aria-label="Options">
        {options.value.map((option) => (
          <li key={option.id}>{slots.option?.({ option })}</li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() =>
          (options.value = options.value.map((option) =>
            option.id === "x" ? { id: "x", label: "Xenon" } : option,
          ))
        }
      >
        Rename option
      </button>
      <button type="button" onClick={() => (options.value = [...options.value].reverse())}>
        Reverse options
      </button>
      <button
        type="button"
        onClick={() => (options.value = options.value.filter((option) => option.id !== "y"))}
      >
        Remove option
      </button>
    </div>
  );
}
