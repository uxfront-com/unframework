import { type Accessor, For, type JSX, createMemo, createSignal, untrack } from "solid-js";

export default function EventLog(props: { class?: string; style?: JSX.CSSProperties }) {
  const [log, setLog] = createSignal<string[]>([]);
  const [volume, setVolume] = createSignal(5);

  function record(line: string) {
    setLog([...log(), line]);
  }

  function changeVolume(event: WheelEvent) {
    if (event.deltaY < 0) {
      setVolume(volume() + 1);
    } else {
      setVolume(volume() - 1);
    }
  }

  return (
    <section
      class={props.class ? `event-log ${props.class}` : "event-log"}
      aria-label="Event options"
      style={props.style}
      {...scopeAttributes(props)}
    >
      <div
        class="panel"
        role="presentation"
        ref={(element) =>
          element.addEventListener("click", () => record("panel capture"), { capture: true })
        }
        on:click={() => record("panel bubble")}
      >
        <button type="button" on:click={() => record("button")}>
          Inside
        </button>
        <button
          type="button"
          on:click={(event) => {
            event.stopPropagation();
            record("stopped");
          }}
        >
          Stop here
        </button>
      </div>
      <button type="button" on:click={{ handleEvent: () => record("once"), once: true }}>
        Only once
      </button>
      <div class="reward" role="presentation" on:click={() => record("outer")}>
        <button
          type="button"
          on:click={{
            handleEvent: (event) => {
              event.stopPropagation();
              record("claimed");
            },
            once: true,
          }}
        >
          Claim the reward
        </button>
      </div>
      <div
        class="volume"
        role="group"
        aria-label="Volume"
        on:wheel={{ handleEvent: changeVolume, passive: true }}
      >
        <output>{volume()}</output>
      </div>
      <ol aria-label="Log">
        <KeyedFor each={log()} by={(entry, index) => index}>
          {(entry) => <li>{entry()}</li>}
        </KeyedFor>
      </ol>
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}

/** A list whose rows follow their keys, so a row keeps its element while the list reorders and while its item is replaced. */
function KeyedFor<T>(props: {
  each: readonly T[];
  by: (item: T, index: number) => unknown;
  children: (item: Accessor<T>, index: Accessor<number>) => JSX.Element;
}): JSX.Element {
  const items = createMemo(() => {
    const rows = new Map<unknown, T>();
    props.each.forEach((item, index) => {
      const key = props.by(item, index);
      rows.set(rows.has(key) ? {} : key, item);
    });
    return rows;
  });
  return (
    <For each={[...items().keys()]}>
      {(key, index) => {
        const item = createMemo(() => items().get(key) as T);
        return untrack(() => props.children(item, index));
      }}
    </For>
  );
}
