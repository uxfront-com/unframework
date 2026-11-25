import { KeyedFor } from "./_unframework/KeyedFor";
import { createState } from "./_unframework/createState";
import { nextTick } from "./_unframework/nextTick";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface PickerEvents {
  onDone?: (step: number, status: string) => void;
}

export default function Picker(
  props: PickerEvents &
    Omit<ComponentProps<"section">, "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "onDone", "class");

  const [selected, setSelected] = createState("none");
  const [hits, setHits] = createState(0);
  const [log, setLog] = createState<string[]>([]);
  const [status, setStatus] = createState("idle");
  const [step, setStep] = createState(0);

  function record(line: string) {
    setLog([...log(), line]);
  }

  function pick(name: string) {
    setSelected(name);
    setHits(hits() + 1);
  }

  function report() {
    record(`picked ${selected()} #${hits()}`);
  }

  async function load() {
    setStatus("loading");
    await Promise.resolve();
    setStep(step() + 1);
  }

  async function run() {
    setStep(step() + 1);
    await load();
    setStatus(`loaded ${step()}`);
    await nextTick();
    props.onDone?.(step(), status());
  }

  function start() {
    void run();
    setStatus("started");
  }

  return (
    <section
      class={props.class ? `picker ${props.class}` : "picker"}
      aria-label="Picker"
      {...others}
    >
      <div class="choices" role="presentation" onClick={report}>
        <button type="button" onClick={() => pick("alpha")}>
          Alpha
        </button>
        <button type="button" onClick={() => pick("beta")}>
          Beta
        </button>
      </div>
      <ol aria-label="Log">
        <KeyedFor each={log()} by={(entry, index) => index}>
          {(entry) => <li>{entry.value}</li>}
        </KeyedFor>
      </ol>
      <p role="status">{status()}</p>
      <button type="button" onClick={start}>
        Start
      </button>
    </section>
  );
}
