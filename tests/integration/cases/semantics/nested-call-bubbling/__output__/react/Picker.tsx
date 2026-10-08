import { useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";

export interface PickerEvents {
  onDone?: (step: number, status: string) => void;
}

export default function Picker({ onDone }: PickerEvents) {
  const onDoneRef = useRef(onDone);
  useLayoutEffect(() => {
    onDoneRef.current = onDone;
  });

  const nextTick = useNextTick();
  const [selected, setSelected] = useState("none");
  const selectedRef = useRef(selected);
  const [hits, setHits] = useState(0);
  const hitsRef = useRef(hits);
  const [log, setLog] = useState<string[]>([]);
  const logRef = useRef(log);
  const [status, setStatus] = useState("idle");
  const statusRef = useRef(status);
  const [step, setStep] = useState(0);
  const stepRef = useRef(step);

  function record(line: string) {
    logRef.current = [...logRef.current, line];
    setLog(logRef.current);
  }

  function pick(name: string) {
    selectedRef.current = name;
    setSelected(selectedRef.current);
    hitsRef.current += 1;
    setHits(hitsRef.current);
  }

  function report() {
    record(`picked ${selectedRef.current} #${hitsRef.current}`);
  }

  async function load() {
    statusRef.current = "loading";
    setStatus(statusRef.current);
    await Promise.resolve();
    stepRef.current += 1;
    setStep(stepRef.current);
  }

  async function run() {
    stepRef.current += 1;
    setStep(stepRef.current);
    await load();
    statusRef.current = `loaded ${stepRef.current}`;
    setStatus(statusRef.current);
    await nextTick();
    onDoneRef.current?.(stepRef.current, statusRef.current);
  }

  function start() {
    void run();
    statusRef.current = "started";
    setStatus(statusRef.current);
  }

  return (
    <section className="picker" aria-label="Picker">
      <div className="choices" role="presentation" onClick={report}>
        <button type="button" onClick={() => pick("alpha")}>
          Alpha
        </button>
        <button type="button" onClick={() => pick("beta")}>
          Beta
        </button>
      </div>
      <ol aria-label="Log">
        {log.map((entry, index) => (
          <li key={index}>{entry}</li>
        ))}
      </ol>
      <p role="status">{status}</p>
      <button type="button" onClick={start}>
        Start
      </button>
    </section>
  );
}

/**
 * Vue's `nextTick` for one component: the promise resolves once React has rendered the writes
 * made before it and run their effects, and `settled` says nothing they wrote waits to render;
 * in the task of a click or a key that wrote, as on Vue. It resolves when the component unmounts
 * too.
 */
function useNextTick(settled: () => boolean = () => true): () => Promise<void> {
  const pending = useRef<{ ticket: number; resolve: () => void }[]>([]);
  const tickets = useRef(0);
  const mounted = useRef(false);
  const [rendered, render] = useReducer(
    (last: number, ticket: number) => Math.max(last, ticket),
    0,
  );
  useEffect(() => {
    if (!pending.current.length) return;
    // Once every effect of the commit has run.
    queueMicrotask(() => {
      if (!settled()) {
        // What the component's effects wrote has yet to render, and may end where it was, when
        // React commits nothing: a render of its own makes the next look certain.
        tickets.current += 1;
        render(tickets.current);
        return;
      }
      const due = pending.current.filter(({ ticket }) => ticket <= rendered);
      pending.current = pending.current.filter(({ ticket }) => ticket > rendered);
      for (const { resolve } of due) resolve();
    });
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      queueMicrotask(() => {
        if (mounted.current) return;
        const due = pending.current;
        pending.current = [];
        for (const { resolve } of due) resolve();
      });
    };
  }, []);
  return () =>
    new Promise<void>((resolve) => {
      tickets.current += 1;
      const ticket = tickets.current;
      pending.current.push({ ticket, resolve });
      render(ticket);
    });
}
