import { cx } from "./_unframework/cx";
import { listen } from "./_unframework/listen";
import { useOnce } from "./_unframework/useOnce";
import { type ComponentPropsWithRef, useRef, useState } from "react";

export type ListenerOrderAttributes = Omit<ComponentPropsWithRef<"section">, "children">;

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
      {...attributes}
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
