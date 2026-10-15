import { type CSSProperties, useId, useRef, useState } from "react";

export interface SizePickerProps {
  legend: string;
  sizes: string[];
}

export interface SizePickerAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function SizePicker({
  legend,
  sizes,
  className,
  style,
}: SizePickerProps & SizePickerAttributes) {
  const group = `uf-id-${useId()}`;
  const hintId = `uf-id-${useId()}`;
  const [picked, setPicked] = useState("");
  const pickedRef = useRef(picked);

  function choose(size: string) {
    pickedRef.current = size;
    setPicked(pickedRef.current);
  }

  return (
    <fieldset className={cx("size-picker", className)} aria-describedby={hintId} style={style}>
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

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
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
