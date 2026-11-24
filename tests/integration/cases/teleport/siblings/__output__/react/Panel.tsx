import { cx } from "./_unframework/cx";
import { subscribeNothing } from "./_unframework/subscribeNothing";
import { teleport } from "./_unframework/teleport";
import { type ComponentPropsWithRef, useRef, useState, useSyncExternalStore } from "react";

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
