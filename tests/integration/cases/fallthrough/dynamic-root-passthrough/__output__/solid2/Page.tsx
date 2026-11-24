import Base from "./Base";
import Primary from "./Primary";
import { KeyedFor } from "./_unframework/KeyedFor";
import { clearedRef } from "./_unframework/clearedRef";
import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";

export default function Page(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const [linked, setLinked] = createState(true);
  const [log, setLog] = createState<string[]>([]);
  let direct: HTMLAnchorElement | HTMLButtonElement | null = null;
  let chained: HTMLAnchorElement | HTMLButtonElement | null = null;

  function record(line: string) {
    setLog([...log(), line]);
  }

  return (
    <section aria-label="Page" {...props}>
      <Base
        href={linked() ? "#direct" : undefined}
        text="Direct"
        id="direct"
        aria-label="Direct"
        data-testid="direct"
        title="Go"
        onClick={(event) => record(`click on ${(event.currentTarget as Element).localName}`)}
        onKeyDown={(event) =>
          record(`keydown ${event.key} on ${(event.currentTarget as Element).localName}`)
        }
        ref={clearedRef(
          (element) => {
            direct = element;
          },
          () => {
            direct = null;
          },
        )}
      />
      <Primary
        href={linked() ? "#chained" : undefined}
        text="Chained"
        id="chained"
        aria-label="Chained"
        data-testid="chained"
        onClick={(event) => record(`chained on ${(event.currentTarget as Element).localName}`)}
        ref={clearedRef(
          (element) => {
            chained = element;
          },
          () => {
            chained = null;
          },
        )}
      />
      <button type="button" onClick={() => setLinked(!linked())}>
        Toggle
      </button>
      <button type="button" onClick={() => direct?.focus()}>
        Focus direct
      </button>
      <button type="button" onClick={() => chained?.focus()}>
        Focus chained
      </button>
      <ol aria-label="Log">
        <KeyedFor each={log()} by={(entry, index) => index}>
          {(entry) => <li>{entry.value}</li>}
        </KeyedFor>
      </ol>
    </section>
  );
}
