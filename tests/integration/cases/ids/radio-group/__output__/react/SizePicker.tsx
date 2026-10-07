import { useId, useRef, useState } from "react";

export interface SizePickerProps {
  legend: string;
  sizes: string[];
}

export default function SizePicker({ legend, sizes }: SizePickerProps) {
  const group = `uf-id-${useId()}`;
  const hintId = `uf-id-${useId()}`;
  const [picked, setPicked] = useState("");
  const pickedRef = useRef(picked);

  function choose(size: string) {
    pickedRef.current = size;
    setPicked(pickedRef.current);
  }

  return (
    <fieldset className="size-picker" aria-describedby={hintId}>
      <legend>{legend}</legend>
      <p id={hintId}>Pick one size.</p>
      {sizes.map((size, index) => (
        <div key={size} className="size">
          <input
            type="radio"
            id={`${group}-${index}`}
            name={group}
            value={size}
            ref={(element) => listen(element, "change", () => choose(size))}
          />
          <label htmlFor={`${group}-${index}`}>{size}</label>
        </div>
      ))}
      <output>{picked || "none"}</output>
    </fieldset>
  );
}

/**
 * Listens to a DOM event natively, where React's synthetic event would not keep the DOM's
 * semantics, and gives back what stops it: the cleanup a ref callback returns.
 */
function listen<K extends keyof HTMLElementEventMap>(
  element: EventTarget | null,
  type: K,
  listener: (event: HTMLElementEventMap[K]) => void,
  options?: AddEventListenerOptions,
): () => void {
  element?.addEventListener(type, listener as EventListener, options);
  return () => element?.removeEventListener(type, listener as EventListener, options);
}
