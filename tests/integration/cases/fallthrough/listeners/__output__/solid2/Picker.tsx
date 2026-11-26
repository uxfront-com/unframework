import Chip from "./Chip";
import { KeyedFor } from "./_unframework/KeyedFor";
import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";

export default function Picker(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const [log, setLog] = createState<string[]>([]);

  function record(line: string) {
    setLog([...log(), line]);
  }

  return (
    <section aria-label="Picker" {...props}>
      <Chip
        label="Ada"
        onClick={(event) => record(`click on ${(event.currentTarget as Element).localName}`)}
        onPick={(label) => record(`pick ${label}`)}
        onFocus={(event) => record(`focus on ${(event.currentTarget as Element).localName}`)}
        onKeyDown={(event) =>
          record(`keydown ${event.key} on ${(event.currentTarget as Element).localName}`)
        }
      />
      <ol aria-label="Log">
        <KeyedFor each={log()} by={(entry, index) => index}>
          {(entry) => <li>{entry.value}</li>}
        </KeyedFor>
      </ol>
    </section>
  );
}
