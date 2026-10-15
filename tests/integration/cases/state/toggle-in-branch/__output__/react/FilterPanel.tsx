import { type CSSProperties, useRef, useState } from "react";

export interface FilterPanelAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function FilterPanel({ className, style }: FilterPanelAttributes) {
  const [open, setOpen] = useState(false);
  const openRef = useRef(open);
  const [colour, setColour] = useState<string | null>(null);
  const colourRef = useRef(colour);
  const [note, setNote] = useState<string | null>(null);
  const noteRef = useRef(note);

  return (
    <section className={cx("filter-panel", className)} aria-label="Filters" style={style}>
      {open ? (
        <button
          key={0}
          type="button"
          aria-expanded="true"
          onClick={() => {
            openRef.current = false;
            setOpen(openRef.current);
          }}
        >
          Hide colours
        </button>
      ) : (
        <button
          key={1}
          type="button"
          aria-expanded="false"
          onClick={() => {
            openRef.current = true;
            setOpen(openRef.current);
          }}
        >
          Show colours
        </button>
      )}
      {open ? (
        <div className="colours">
          <button
            type="button"
            onClick={() => {
              colourRef.current = "Red";
              setColour(colourRef.current);
            }}
          >
            Red
          </button>
          <button
            type="button"
            onClick={() => {
              colourRef.current = "Blue";
              setColour(colourRef.current);
            }}
          >
            Blue
          </button>
          <button
            type="button"
            onClick={() => {
              colourRef.current = null;
              setColour(colourRef.current);
              openRef.current = false;
              setOpen(openRef.current);
            }}
          >
            Reset
          </button>
        </div>
      ) : null}
      {colour ? (
        <div className="selection">
          <p>{`Colour: ${colour}`}</p>
          <button
            type="button"
            onClick={() => {
              colourRef.current = null;
              setColour(colourRef.current);
            }}
          >{`Clear ${colour}`}</button>
        </div>
      ) : (
        <p>No colour</p>
      )}
      {note === null ? (
        <button
          type="button"
          onClick={() => {
            noteRef.current = "";
            setNote(noteRef.current);
          }}
        >
          Add a note
        </button>
      ) : (
        <div className="note">
          <label>
            Note
            <input
              onInput={(event) => {
                noteRef.current = (event.currentTarget as HTMLInputElement).value;
                setNote(noteRef.current);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  noteRef.current = null;
                  setNote(noteRef.current);
                }
              }}
            />
          </label>
          <p>{`Draft: "${note}"`}</p>
        </div>
      )}
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
