import Base from "./Base";
import Primary from "./Primary";
import { type ComponentPropsWithRef, useRef, useState } from "react";

export type PageAttributes = Omit<ComponentPropsWithRef<"section">, "children">;

export default function Page({ className, style, ...attributes }: PageAttributes) {
  const [linked, setLinked] = useState(true);
  const linkedRef = useRef(linked);
  const [log, setLog] = useState<string[]>([]);
  const logRef = useRef(log);
  const direct = useRef<HTMLAnchorElement | HTMLButtonElement>(null);
  const chained = useRef<HTMLAnchorElement | HTMLButtonElement>(null);

  function record(line: string) {
    logRef.current = [...logRef.current, line];
    setLog(logRef.current);
  }

  return (
    <section aria-label="Page" className={className} style={style} {...attributes}>
      <Base
        href={linked ? "#direct" : undefined}
        text="Direct"
        ref={direct}
        id="direct"
        aria-label="Direct"
        data-testid="direct"
        title="Go"
        onClick={(event) => record(`click on ${(event.currentTarget as Element).localName}`)}
        onKeyDown={(event) =>
          record(`keydown ${event.key} on ${(event.currentTarget as Element).localName}`)
        }
      />
      <Primary
        href={linked ? "#chained" : undefined}
        text="Chained"
        ref={chained}
        id="chained"
        aria-label="Chained"
        data-testid="chained"
        onClick={(event) => record(`chained on ${(event.currentTarget as Element).localName}`)}
      />
      <button
        type="button"
        onClick={() => {
          linkedRef.current = !linkedRef.current;
          setLinked(linkedRef.current);
        }}
      >
        Toggle
      </button>
      <button type="button" onClick={() => direct.current?.focus()}>
        Focus direct
      </button>
      <button type="button" onClick={() => chained.current?.focus()}>
        Focus chained
      </button>
      <ol aria-label="Log">
        {log.map((entry, index) => (
          <li key={index}>{entry}</li>
        ))}
      </ol>
    </section>
  );
}
