import {
  type ComponentPropsWithRef,
  type ReactNode,
  type ReactPortal,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

interface Row {
  id: number;
  label: string;
}

export type PanelAttributes = Omit<ComponentPropsWithRef<"section">, "children">;

export default function Panel({ className, style, ...attributes }: PanelAttributes) {
  const [note, setNote] = useState(false);
  const noteRef = useRef(note);
  const [extras, setExtras] = useState<string[]>([]);
  const extrasRef = useRef(extras);
  const [rows, setRows] = useState<Row[]>([
    { id: 1, label: "Alpha" },
    { id: 2, label: "Beta" },
  ]);
  const rowsRef = useRef(rows);

  function addExtra() {
    extrasRef.current = [...extrasRef.current, `Extra ${extrasRef.current.length + 1}`];
    setExtras(extrasRef.current);
  }

  const mounted = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );

  return (
    <section className={cx("panel", className)} aria-label="Panel" style={style} {...attributes}>
      <button
        type="button"
        onClick={() => {
          noteRef.current = true;
          setNote(noteRef.current);
        }}
      >
        Show note
      </button>
      <button type="button" onClick={addExtra}>
        Add extra
      </button>
      <button
        type="button"
        onClick={() => {
          rowsRef.current = [...rowsRef.current].reverse();
          setRows(rowsRef.current);
        }}
      >
        Reverse rows
      </button>
      {note ? <p className="note">Note</p> : null}
      {extras.map((extra) => (
        <span key={extra}>{extra}</span>
      ))}
      {mounted
        ? teleport(
            <div data-teleported="true" className="first">
              First
            </div>,
            "body",
          )
        : null}
      {mounted
        ? teleport(
            <div data-teleported="true" className="second">
              Second
            </div>,
            "body",
          )
        : null}
      <ul>
        {rows.map((row) => (
          <li key={row.id}>
            {row.label}
            {mounted
              ? teleport(
                  <p data-teleported="true" className="tip">
                    {row.label} tip
                  </p>,
                  "body",
                )
              : null}
          </li>
        ))}
      </ul>
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

/** Subscribes to nothing: whether the component has mounted never changes once it has. */
function subscribeNothing(): () => void {
  return () => {};
}

/** Portals `children` into the element `to` selects, or renders nothing where none does. */
function teleport(children: ReactNode, to: string): ReactPortal | null {
  const target = document.querySelector(to);
  return target ? createPortal(children, target) : null;
}
