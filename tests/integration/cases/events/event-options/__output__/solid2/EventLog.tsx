import { KeyedFor } from "./_unframework/KeyedFor";
import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function EventLog(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const others = omit(props, "class");

  const [log, setLog] = createState<string[]>([]);
  const [volume, setVolume] = createState(5);

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
        ref={(element) => {
          element.addEventListener("click", () => record("panel capture"), { capture: true });
          element.addEventListener("click", () => record("panel bubble"));
        }}
      >
        <button
          type="button"
          ref={(element) => element.addEventListener("click", () => record("button"))}
        >
          Inside
        </button>
        <button
          type="button"
          ref={(element) =>
            element.addEventListener("click", (event) => {
              event.stopPropagation();
              record("stopped");
            })
          }
        >
          Stop here
        </button>
      </div>
      <button
        type="button"
        ref={(element) => element.addEventListener("click", () => record("once"), { once: true })}
      >
        Only once
      </button>
      <div
        class="reward"
        role="presentation"
        ref={(element) => element.addEventListener("click", () => record("outer"))}
      >
        <button
          type="button"
          ref={(element) =>
            element.addEventListener(
              "click",
              (event) => {
                event.stopPropagation();
                record("claimed");
              },
              { once: true },
            )
          }
        >
          Claim the reward
        </button>
      </div>
      <div
        class="volume"
        role="group"
        aria-label="Volume"
        ref={(element) => element.addEventListener("wheel", changeVolume, { passive: true })}
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
