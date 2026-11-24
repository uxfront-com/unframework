import { KeyedFor } from "./_unframework/KeyedFor";
import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function ListenerOrder(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const others = omit(props, "class");

  const [log, setLog] = createState<string[]>([]);
  const [resets, setResets] = createState(0);

  function record(line: string) {
    setLog([...log(), line]);
  }

  return (
    <section
      class={props.class ? `listener-order ${props.class}` : "listener-order"}
      aria-label="Listener order"
      {...others}
    >
      <div
        class="toolbar"
        role="presentation"
        ref={(element) => element.addEventListener("click", () => record("toolbar"))}
      >
        <button
          type="button"
          ref={(element) => {
            element.addEventListener("click", () => record("save"));
            element.addEventListener("click", () => record("first save"), { once: true });
          }}
        >
          Save
        </button>
        <button
          type="button"
          ref={(element) => {
            element.addEventListener("click", () => record("first send"), { once: true });
            element.addEventListener("click", () => record("send"));
          }}
        >
          Send
        </button>
        <button
          type="button"
          ref={(element) => {
            element.addEventListener("click", () => record("reset"));
            element.addEventListener("click", () => setResets(resets() + 1), { once: true });
          }}
        >
          Reset
        </button>
      </div>
      <div
        class="panel"
        role="presentation"
        ref={(element) => {
          element.addEventListener("click", () => record("panel capture"), { capture: true });
          element.addEventListener("click", (event) => {
            event.stopPropagation();
            record("panel bubble");
          });
        }}
      >
        <button
          type="button"
          ref={(element) => element.addEventListener("click", () => record("inside"))}
        >
          Inside
        </button>
      </div>
      <button
        type="button"
        ref={(element) => element.addEventListener("click", () => record("outside"))}
      >
        Outside
      </button>
      <div
        class="claim"
        role="presentation"
        ref={(element) =>
          element.addEventListener("click", () => record("claim once"), { once: true })
        }
      >
        <button
          type="button"
          ref={(element) =>
            element.addEventListener("click", (event) => {
              event.stopPropagation();
              record("stopped");
            })
          }
        >
          Stop
        </button>
        <button
          type="button"
          ref={(element) => element.addEventListener("click", () => record("pass"))}
        >
          Pass
        </button>
      </div>
      <div
        class="outer-zone"
        role="group"
        aria-label="Outer zone"
        onWheel={() => record("outer wheel")}
      >
        <div
          class="inner-zone"
          role="group"
          aria-label="Inner zone"
          ref={(element) =>
            element.addEventListener("wheel", () => record("inner wheel"), { passive: true })
          }
        >
          Scroll here
        </div>
      </div>
      <p>Resets: {resets()}</p>
      <ol aria-label="Log">
        <KeyedFor each={log()} by={(entry, index) => index}>
          {(entry) => <li>{entry.value}</li>}
        </KeyedFor>
      </ol>
    </section>
  );
}
