import { useEffect, useEffectEvent, useRef, useState } from "react";

export interface NameSorterEvents {
  onStarted?: (text: string) => void;
  onFirstSeen?: (text: string) => void;
  onSecondSeen?: (count: number) => void;
  onTotal?: (letters: number) => void;
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export default function NameSorter({
  onStarted,
  onFirstSeen,
  onSecondSeen,
  onTotal,
}: NameSorterEvents) {
  const [names, setNames] = useState(() => ["Cy", "Al"].toSorted((a, b) => compare(a, b)));
  const namesRef = useRef(names);
  const [count, setCount] = useState(0);
  const countRef = useRef(count);

  function currentDoubled() {
    return countRef.current * 2;
  }

  function currentLetters() {
    return namesRef.current.join("").length;
  }

  function describe(): string {
    return `doubled ${currentDoubled()}`;
  }

  const onMount = useEffectEvent(() => {
    onStarted?.(`first ${describe()}`);
  });
  useEffect(() => {
    onMount();
  }, []);

  const onMount_1 = useEffectEvent(() => {
    onStarted?.("second");
  });
  useEffect(() => {
    onMount_1();
  }, []);

  const previousCount = useRef(count);
  const onCountChange = useEffectEvent(() => {
    onFirstSeen?.(describe());
  });
  useEffect(() => {
    const previous = previousCount.current;
    if (Object.is(previous, count)) return;
    previousCount.current = count;
    onCountChange();
  }, [count]);

  const previousCount_1 = useRef(count);
  const onCountChange_1 = useEffectEvent((value: typeof count) => {
    onSecondSeen?.(value);
  });
  useEffect(() => {
    const previous = previousCount_1.current;
    if (Object.is(previous, count)) return;
    previousCount_1.current = count;
    onCountChange_1(count);
  }, [count]);

  function add(name: string) {
    namesRef.current = [...namesRef.current, name].toSorted(compare);
    setNames(namesRef.current);
    countRef.current += 1;
    setCount(countRef.current);
  }

  function report() {
    onTotal?.(currentLetters());
  }

  return (
    <section className="name-sorter" aria-label="Names">
      <p>Names: {names.join(", ")}</p>
      <p>Added: {count}</p>
      <button type="button" onClick={() => add("Bo")}>
        Add Bo
      </button>
      <button type="button" onClick={report}>
        Report
      </button>
    </section>
  );
}
