import Base from "./Base";
import Primary from "./Primary";
import { KeyedFor } from "./_unframework/KeyedFor";
import { type ComponentProps, type JSX, createSignal, onCleanup } from "solid-js";

export default function Page(
  props: Omit<ComponentProps<"section">, "style"> & { style?: JSX.CSSProperties },
) {
  const [linked, setLinked] = createSignal(true);
  const [log, setLog] = createSignal<string[]>([]);
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
        ref={(element) => {
          direct = element;
          onCleanup(() => {
            direct = null;
          });
        }}
      />
      <Primary
        href={linked() ? "#chained" : undefined}
        text="Chained"
        id="chained"
        aria-label="Chained"
        data-testid="chained"
        onClick={(event) => record(`chained on ${(event.currentTarget as Element).localName}`)}
        ref={(element) => {
          chained = element;
          onCleanup(() => {
            chained = null;
          });
        }}
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
