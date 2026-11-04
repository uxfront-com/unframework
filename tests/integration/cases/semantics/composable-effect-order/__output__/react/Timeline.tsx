import { useTracked } from "./useTracked";
import { type CSSProperties, useEffect, useEffectEvent, useRef, useState } from "react";

export interface TimelineAttributes {
  className?: string;
  style?: CSSProperties;
}

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
      {...scopeAttributes(attributes)}
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
