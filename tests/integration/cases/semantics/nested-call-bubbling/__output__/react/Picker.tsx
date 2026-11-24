import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { useNextTick } from "./_unframework/useNextTick";
import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";

export interface PickerEvents {
  onDone?: (step: number, status: string) => void;
}

export interface PickerAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Picker({
  onDone,
  className,
  style,
  ...attributes
}: PickerEvents & PickerAttributes) {
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
    <section
      className={cx("picker", className)}
      aria-label="Picker"
      style={style}
      {...scopeAttributes(attributes)}
    >
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
