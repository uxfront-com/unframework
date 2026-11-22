import {
  type ComponentProps,
  For,
  type JSX,
  createMemo,
  createSignal,
  splitProps,
  untrack,
} from "solid-js";

export interface PickerEvents {
  onDone?: (step: number, status: string) => void;
}

export default function Picker(
  props: PickerEvents & Omit<ComponentProps<"section">, "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["onDone", "class"]);

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

/** A list whose rows follow their keys, so a row keeps its element while the list reorders and while its item is replaced. */
function KeyedFor<T>(props: {
  each: readonly T[];
  by: (item: T, index: number) => unknown;
  children: (row: { readonly value: T; readonly index: number }) => JSX.Element;
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
        return untrack(() =>
          props.children({
            get value() {
              return item();
            },
            get index() {
              return index();
            },
          }),
        );
      }}
    </For>
  );
}

/**
 * Resolves once the DOM has updated and the watchers have run: Solid applies writes as it makes
 * them, and the watchers run in a microtask queued at the first write, before this one.
 */
function nextTick(): Promise<void> {
  return Promise.resolve();
}
