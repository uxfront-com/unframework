import Chip from "./Chip";
import { type ComponentPropsWithRef, useRef, useState } from "react";

export type PickerAttributes = Omit<ComponentPropsWithRef<"section">, "children">;

export default function Picker({ className, style, ...attributes }: PickerAttributes) {
  const [log, setLog] = useState<string[]>([]);
  const logRef = useRef(log);

  function record(line: string) {
    logRef.current = [...logRef.current, line];
    setLog(logRef.current);
  }

  return (
    <section aria-label="Picker" className={className} style={style} {...attributes}>
      <Chip
        label="Ada"
        onPick={(label) => record(`pick ${label}`)}
        onClick={(event) => record(`click on ${(event.currentTarget as Element).localName}`)}
        onFocus={(event) => {
          if (event.target !== event.currentTarget) return;
          record(`focus on ${(event.currentTarget as Element).localName}`);
        }}
        onKeyDown={(event) =>
          record(`keydown ${event.key} on ${(event.currentTarget as Element).localName}`)
        }
      />
      <ol aria-label="Log">
        {log.map((entry, index) => (
          <li key={index}>{entry}</li>
        ))}
      </ol>
    </section>
  );
}
