import { type CSSProperties, useRef, useState } from "react";

export interface ShirtOrderAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function ShirtOrder({ className, style }: ShirtOrderAttributes) {
  const [size, setSize] = useState("M");
  const sizeRef = useRef(size);
  const [quantity, setQuantity] = useState(1);
  const quantityRef = useRef(quantity);
  const [note, setNote] = useState("");
  const noteRef = useRef(note);
  const noteField = useRef<HTMLInputElement>(null);

  return (
    <section className={cx("shirt-order", className)} aria-label="Shirt order" style={style}>
      <p role="status">{`${quantity} x size ${size}`}</p>
      <div role="group" aria-label="Size">
        <button
          type="button"
          value="S"
          aria-pressed={size === "S"}
          onClick={(event) => {
            sizeRef.current = (event.currentTarget as HTMLButtonElement).value;
            setSize(sizeRef.current);
          }}
        >
          Small
        </button>
        <button
          type="button"
          value="M"
          aria-pressed={size === "M"}
          onClick={(event) => {
            sizeRef.current = (event.currentTarget as HTMLButtonElement).value;
            setSize(sizeRef.current);
          }}
        >
          Medium
        </button>
        <button
          type="button"
          value="L"
          aria-pressed={size === "L"}
          onClick={(event) => {
            sizeRef.current = (event.currentTarget as HTMLButtonElement).value;
            setSize(sizeRef.current);
          }}
        >
          Large
        </button>
      </div>
      <button
        type="button"
        onClick={() => {
          quantityRef.current++;
          setQuantity(quantityRef.current);
        }}
      >
        Add one
      </button>
      <label>
        Note
        <input
          name="note"
          ref={noteField}
          onInput={(event) => {
            noteRef.current = (event.currentTarget as HTMLInputElement).value;
            setNote(noteRef.current);
          }}
        />
      </label>
      <p>Note: {note}</p>
      <button
        type="button"
        onClick={() => {
          quantityRef.current = 1;
          setQuantity(quantityRef.current);
          sizeRef.current = "M";
          setSize(sizeRef.current);
          noteRef.current = "";
          setNote(noteRef.current);
          const input = noteField.current;
          if (input) input.value = "";
        }}
      >
        Reset
      </button>
    </section>
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
