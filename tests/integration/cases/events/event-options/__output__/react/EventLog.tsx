import { type CSSProperties, type WheelEvent, useRef, useState } from "react";

export interface EventLogAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function EventLog({ className, style, ...attributes }: EventLogAttributes) {
  const [log, setLog] = useState<string[]>([]);
  const logRef = useRef(log);
  const [volume, setVolume] = useState(5);
  const volumeRef = useRef(volume);

  function record(line: string) {
    logRef.current = [...logRef.current, line];
    setLog(logRef.current);
  }

  function changeVolume(event: WheelEvent) {
    if (event.deltaY < 0) {
      volumeRef.current += 1;
      setVolume(volumeRef.current);
    } else {
      volumeRef.current -= 1;
      setVolume(volumeRef.current);
    }
  }

  const clickOnce = useOnce();
  const clickOnce_1 = useOnce();

  return (
    <section
      className={cx("event-log", className)}
      aria-label="Event options"
      style={style}
      {...scopeAttributes(attributes)}
    >
      <div
        className="panel"
        role="presentation"
        onClickCapture={() => record("panel capture")}
        onClick={() => record("panel bubble")}
      >
        <button type="button" onClick={() => record("button")}>
          Inside
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            record("stopped");
          }}
        >
          Stop here
        </button>
      </div>
      <button
        type="button"
        onClick={(event) => {
          if (!clickOnce(event)) return;
          record("once");
        }}
      >
        Only once
      </button>
      <div className="reward" role="presentation" onClick={() => record("outer")}>
        <button
          type="button"
          onClick={(event) => {
            if (!clickOnce_1(event)) return;
            event.stopPropagation();
            record("claimed");
          }}
        >
          Claim the reward
        </button>
      </div>
      <div className="volume" role="group" aria-label="Volume" onWheel={changeVolume}>
        <output>{volume}</output>
      </div>
      <ol aria-label="Log">
        {log.map((entry, index) => (
          <li key={index}>{entry}</li>
        ))}
      </ol>
    </section>
  );
}

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}

/** The guard of a listener that runs once per element, as `{ once: true }` makes it. */
function useOnce(): (event: { currentTarget: EventTarget | null }) => boolean {
  const fired = useRef(new WeakSet<EventTarget>());
  return (event) => {
    const target = event.currentTarget;
    if (!target || fired.current.has(target)) return false;
    fired.current.add(target);
    return true;
  };
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
