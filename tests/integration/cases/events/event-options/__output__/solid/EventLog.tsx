import { KeyedFor } from "./_unframework/KeyedFor";
import { type ComponentProps, type JSX, createSignal, splitProps } from "solid-js";

export default function EventLog(
  props: Omit<ComponentProps<"section">, "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["class"]);

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
      {...others}
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
          {(entry) => <li>{entry.value}</li>}
        </KeyedFor>
      </ol>
    </section>
  );
}
