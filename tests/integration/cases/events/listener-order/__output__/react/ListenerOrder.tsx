import { type CSSProperties, useRef, useState } from "react";

export interface ListenerOrderAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function ListenerOrder({
  className,
  style,
  ...attributes
}: ListenerOrderAttributes) {
  const [log, setLog] = useState<string[]>([]);
  const logRef = useRef(log);
  const [resets, setResets] = useState(0);
  const resetsRef = useRef(resets);

  function record(line: string) {
    logRef.current = [...logRef.current, line];
    setLog(logRef.current);
  }

  const clickOnce = useOnce();
  const clickOnce_1 = useOnce();
  const clickOnce_2 = useOnce();
  const clickOnce_3 = useOnce();

  const [outerZoneListeners] = useState(
    () => (element: Element | null) => listen(element, "wheel", () => record("outer wheel")),
  );

  const [innerZoneListeners] = useState(
    () => (element: Element | null) =>
      listen(element, "wheel", () => record("inner wheel"), { passive: true }),
  );

  return (
    <section
      className={cx("listener-order", className)}
      aria-label="Listener order"
      style={style}
      {...scopeAttributes(attributes)}
    >
      <div className="toolbar" role="presentation" onClick={() => record("toolbar")}>
        <button
          type="button"
          onClick={(event) => {
            record("save");
            if (clickOnce(event)) {
              record("first save");
            }
          }}
        >
          Save
        </button>
        <button
          type="button"
          onClick={(event) => {
            if (clickOnce_1(event)) {
              record("first send");
            }
            record("send");
          }}
        >
          Send
        </button>
        <button
          type="button"
          onClick={(event) => {
            record("reset");
            if (clickOnce_2(event)) {
              resetsRef.current += 1;
              setResets(resetsRef.current);
            }
          }}
        >
          Reset
        </button>
      </div>
      <div
        className="panel"
        role="presentation"
        onClickCapture={() => record("panel capture")}
        onClick={(event) => {
          event.stopPropagation();
          record("panel bubble");
        }}
      >
        <button type="button" onClick={() => record("inside")}>
          Inside
        </button>
      </div>
      <button type="button" onClick={() => record("outside")}>
        Outside
      </button>
      <div
        className="claim"
        role="presentation"
        onClick={(event) => {
          if (!clickOnce_3(event)) return;
          record("claim once");
        }}
      >
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            record("stopped");
          }}
        >
          Stop
        </button>
        <button type="button" onClick={() => record("pass")}>
          Pass
        </button>
      </div>
      <div className="outer-zone" role="group" aria-label="Outer zone" ref={outerZoneListeners}>
        <div className="inner-zone" role="group" aria-label="Inner zone" ref={innerZoneListeners}>
          Scroll here
        </div>
      </div>
      <p>Resets: {resets}</p>
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

/**
 * Listens to a DOM event natively, where React's synthetic event would not keep the DOM's
 * semantics, and gives back what stops it: the cleanup a ref callback returns.
 */
function listen<K extends keyof HTMLElementEventMap>(
  element: EventTarget | null,
  type: K,
  listener: (event: HTMLElementEventMap[K]) => void,
  options?: AddEventListenerOptions,
): () => void {
  element?.addEventListener(type, listener as EventListener, options);
  return () => element?.removeEventListener(type, listener as EventListener, options);
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
