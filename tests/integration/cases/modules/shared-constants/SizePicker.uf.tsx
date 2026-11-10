import { ref } from "unframework";

import { DEFAULT_SIZE, SIZE_ORDER, SIZES } from "./tokens";
import type { Size } from "./tokens";

export default function SizePicker() {
  const size = ref<Size>(DEFAULT_SIZE);

  function pick(next: Size) {
    size.value = next;
  }

  return (
    <fieldset class="size-picker">
      <legend>Size</legend>
      <p role="status">Picked: {SIZES[size.value]}</p>
      <ul>
        {SIZE_ORDER.map((each) => (
          <li key={each}>
            <button type="button" aria-pressed={size.value === each} onClick={() => pick(each)}>
              {SIZES[each]}
            </button>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
