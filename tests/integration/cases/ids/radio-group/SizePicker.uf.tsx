import { ref, useId } from "unframework";

export interface SizePickerProps {
  legend: string;
  sizes: string[];
}

export default function SizePicker({ legend, sizes }: SizePickerProps) {
  const group = useId();
  const hintId = useId();
  const picked = ref("");

  function choose(size: string) {
    picked.value = size;
  }

  return (
    <fieldset class="size-picker" aria-describedby={hintId}>
      <legend>{legend}</legend>
      <p id={hintId}>Pick one size.</p>
      {sizes.map((size, index) => (
        <div key={size} class="size">
          <input
            type="radio"
            id={`${group}-${index}`}
            name={group}
            value={size}
            onChange={() => choose(size)}
          />
          <label for={`${group}-${index}`}>{size}</label>
        </div>
      ))}
      <output>{picked.value || "none"}</output>
    </fieldset>
  );
}
