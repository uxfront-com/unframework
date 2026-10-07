import { createSignal, onCleanup } from "solid-js";

export interface ListenersEvents {
  onLogged?: (entries: string[]) => void;
}

export default function Listeners(props: ListenersEvents) {
  const [log, setLog] = createSignal<string[]>([]);
  const [volume, setVolume] = createSignal(0);
  let field: HTMLInputElement | null = null;

  function record(line: string) {
    setLog([...log(), line]);
  }

  function scroll(event: WheelEvent) {
    setVolume(volume() + (event.deltaY < 0 ? 1 : -1));
  }

  function report() {
    record("report");
    props.onLogged?.(log());
  }

  return (
    <section aria-label="Listeners">
      <div
        role="presentation"
        ref={(element) =>
          element.addEventListener("click", () => record("capture"), { capture: true })
        }
        on:click={() => record("bubble")}
      >
        <button type="button" on:click={() => record("inside")}>
          Inside
        </button>
        <button
          type="button"
          on:click={(event) => {
            event.stopPropagation();
            record("stopped");
          }}
        >
          Stop
        </button>
        <button type="button" on:click={{ handleEvent: () => record("once"), once: true }}>
          Once
        </button>
      </div>
      <button
        type="button"
        ref={(element) =>
          element.addEventListener("click", () => record("own capture"), { capture: true })
        }
        on:click={report}
      >
        Report
      </button>
      <button
        type="button"
        ref={(element) => {
          element.addEventListener("click", () => record("plain"));
          element.addEventListener("click", () => record("first"), { once: true });
        }}
      >
        Pair
      </button>
      <button
        type="button"
        ref={(element) => {
          element.addEventListener("click", () => record("first swap"), { once: true });
          element.addEventListener("click", () => record("swap"));
        }}
      >
        Swap
      </button>
      <div role="group" aria-label="Volume" on:wheel={{ handleEvent: scroll, passive: true }}>
        <output>{volume()}</output>
      </div>
      <label>
        Name
        <input
          name="name"
          ref={(element) => {
            field = element;
            onCleanup(() => {
              field = null;
            });
            element.addEventListener("keydown", () => record("key capture"), { capture: true });
          }}
          onFocus={() => record("focus")}
          onBlur={() => record("blur")}
          onChange={() => record(`change ${field?.value ?? ""}`)}
          onKeyDown={(event) => event.key === "Enter" && record("enter")}
        />
      </label>
      <p>{log().join(", ")}</p>
    </section>
  );
}
