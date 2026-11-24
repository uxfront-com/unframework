import { cx } from "./_unframework/cx";
import { useTracked } from "./useTracked";
import { type ComponentPropsWithRef, useEffect, useEffectEvent, useRef, useState } from "react";

export type TimelineAttributes = Omit<ComponentPropsWithRef<"section">, "children">;

export default function Timeline({ className, style, ...attributes }: TimelineAttributes) {
  const [entries, setEntries] = useState<string[]>([]);
  const entriesRef = useRef(entries);

  function record(entry: string) {
    entriesRef.current = [...entriesRef.current, entry];
    setEntries(entriesRef.current);
  }

  const onMount = useEffectEvent(() => record("caller mounted first"));
  useEffect(() => {
    onMount();
  }, []);

  const { count, increment } = useTracked((entry) => record(entry));

  const previousCount = useRef(count);
  const onCountChange = useEffectEvent(() => record("caller watcher"));
  useEffect(() => {
    const previous = previousCount.current;
    if (Object.is(previous, count)) return;
    previousCount.current = count;
    onCountChange();
  }, [count]);

  const onMount_1 = useEffectEvent(() => record("caller mounted last"));
  useEffect(() => {
    onMount_1();
  }, []);

  return (
    <section
      className={cx("timeline", className)}
      aria-label="Timeline"
      style={style}
      {...attributes}
    >
      <p role="status">Count: {count}</p>
      <button type="button" onClick={() => increment()}>
        Increment
      </button>
      <ol>
        {entries.map((entry, index) => (
          <li key={index}>{entry}</li>
        ))}
      </ol>
    </section>
  );
}
