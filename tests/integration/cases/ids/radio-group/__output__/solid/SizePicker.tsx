import { For, createSignal, createUniqueId } from "solid-js";

export interface SizePickerProps {
  legend: string;
  sizes: string[];
}

export default function SizePicker(props: SizePickerProps) {
  const group = `uf-id-${createUniqueId()}`;
  const hintId = `uf-id-${createUniqueId()}`;
  const [picked, setPicked] = createSignal("");

  function choose(size: string) {
    setPicked(size);
  }

  return (
    <fieldset class="size-picker" aria-describedby={hintId}>
      <legend>{props.legend}</legend>
      <p id={hintId}>Pick one size.</p>
      <For each={props.sizes}>
        {(size, index) => (
          <div class="size">
            <input
              type="radio"
              id={`${group}-${index()}`}
              name={group}
              value={size}
              onChange={() => choose(size)}
            />
            <label for={`${group}-${index()}`}>{size}</label>
          </div>
        )}
      </For>
      <output>{picked() || "none"}</output>
    </fieldset>
  );
}
