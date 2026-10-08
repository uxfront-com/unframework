import { useEffect, useEffectEvent, useLayoutEffect, useReducer, useRef, useState } from "react";

export interface SearchResultsEvents {
  onReady?: (text: string) => void;
  onRendered?: (count: number) => void;
  onShown?: (text: string) => void;
}

export default function SearchResults({ onReady, onRendered, onShown }: SearchResultsEvents) {
  const onReadyRef = useRef(onReady);
  const onShownRef = useRef(onShown);
  useLayoutEffect(() => {
    onReadyRef.current = onReady;
    onShownRef.current = onShown;
  });

  const [status, setStatus] = useState("Loading");
  const statusRef = useRef(status);
  const [query, setQuery] = useState("");
  const queryRef = useRef(query);
  const [results, setResults] = useState<string[]>([]);
  const resultsRef = useRef(results);
  const [count, setCount] = useState(0);
  const countRef = useRef(count);
  const [doubled, setDoubled] = useState(0);
  const doubledRef = useRef(doubled);
  const nextTick = useNextTick(
    () =>
      Object.is(statusRef.current, status) &&
      Object.is(resultsRef.current, results) &&
      Object.is(doubledRef.current, doubled),
  );
  const banner = useRef<HTMLParagraphElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const total = useRef<HTMLOutputElement>(null);

  const previousQuery = useRef(query);
  const onQueryChange = useEffectEvent((value: typeof query) => {
    resultsRef.current = value === "" ? [] : [value, `${value} docs`];
    setResults(resultsRef.current);
  });
  useEffect(() => {
    const previous = previousQuery.current;
    if (Object.is(previous, query)) return;
    previousQuery.current = query;
    onQueryChange(query);
  }, [query]);

  const previousCount = useRef(count);
  const onCountChange = useEffectEvent((value: typeof count) => {
    doubledRef.current = value * 2;
    setDoubled(doubledRef.current);
  });
  useEffect(() => {
    const previous = previousCount.current;
    if (Object.is(previous, count)) return;
    previousCount.current = count;
    onCountChange(count);
  }, [count]);

  const [waits, setWaits] = useState(0);
  const previousQuery_1 = useRef(query);
  const onQueryChange_1 = useEffectEvent(() => {
    onRendered?.(list.current?.childElementCount ?? -1);
  });
  useEffect(() => {
    if (!Object.is(resultsRef.current, results) || !Object.is(doubledRef.current, doubled)) {
      setWaits(waits + 1);
      return;
    }
    const previous = previousQuery_1.current;
    if (Object.is(previous, query)) return;
    previousQuery_1.current = query;
    onQueryChange_1();
  }, [query, results, doubled, waits]);

  const onMount = useEffectEvent(async () => {
    statusRef.current = "Ready";
    setStatus(statusRef.current);
    await nextTick();
    onReadyRef.current?.(banner.current?.textContent ?? "");
  });
  useEffect(() => {
    onMount();
  }, []);

  async function addOne() {
    countRef.current += 1;
    setCount(countRef.current);
    await nextTick();
    onShownRef.current?.(total.current?.textContent ?? "");
  }

  return (
    <section className="search-results" aria-label="Search">
      <p ref={banner}>{status}</p>
      <label>
        Query
        <input
          name="query"
          onInput={(event) => {
            queryRef.current = (event.currentTarget as HTMLInputElement).value;
            setQuery(queryRef.current);
          }}
        />
      </label>
      <ul ref={list} aria-label="Results">
        {results.map((result) => (
          <li key={result}>{result}</li>
        ))}
      </ul>
      <output ref={total}>{doubled}</output>
      <button type="button" onClick={addOne}>
        Add one
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
