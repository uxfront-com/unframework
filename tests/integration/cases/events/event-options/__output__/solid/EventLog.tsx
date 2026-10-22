import { For, type JSX, createSignal } from "solid-js";

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
        <For each={log()}>{(entry) => <li>{entry}</li>}</For>
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
