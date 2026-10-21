import { For, type JSX, createSignal } from "solid-js";

export interface PickerEvents {
  onDone?: (step: number, status: string) => void;
}

export default function Picker(
  props: PickerEvents & { class?: string; style?: JSX.CSSProperties },
) {
  const [selected, setSelected] = createSignal("none");
  const [hits, setHits] = createSignal(0);
  const [log, setLog] = createSignal<string[]>([]);
  const [status, setStatus] = createSignal("idle");
  const [step, setStep] = createSignal(0);

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
      style={props.style}
      {...scopeAttributes(props)}
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
        <For each={log()}>{(entry) => <li>{entry}</li>}</For>
      </ol>
      <p role="status">{status()}</p>
      <button type="button" onClick={start}>
        Start
      </button>
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}

/**
 * Resolves once the DOM has updated and the watchers have run: Solid applies writes as it makes
 * them, and the watchers run in a microtask queued at the first write, before this one.
 */
function nextTick(): Promise<void> {
  return Promise.resolve();
}
