import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";

export interface SearchSessionEvents {
  onUnmounted?: () => void;
  onEffectCleaned?: (query: string) => void;
  onWatchCleaned?: (query: string) => void;
  onSearched?: (query: string, count: number) => void;
  onSearchCleaned?: (query: string) => void;
  onSummary?: (text: string) => void;
}

export default function SearchSession({
  onUnmounted,
  onEffectCleaned,
  onWatchCleaned,
  onSearched,
  onSearchCleaned,
  onSummary,
}: SearchSessionEvents) {
  const onEffectCleanedRef = useRef(onEffectCleaned);
  const onWatchCleanedRef = useRef(onWatchCleaned);
  const onSearchCleanedRef = useRef(onSearchCleaned);
  useLayoutEffect(() => {
    onEffectCleanedRef.current = onEffectCleaned;
    onWatchCleanedRef.current = onWatchCleaned;
    onSearchCleanedRef.current = onSearchCleaned;
  });

  const [query, setQuery] = useState("");
  const queryRef = useRef(query);
  const [results, setResults] = useState<string[]>([]);
  const resultsRef = useRef(results);

  const previousQuery = useRef<typeof query | undefined>(undefined);
  const onQueryChange = useEffectEvent(
    (
      value: typeof query,
      previous: typeof query | undefined,
      onCleanup: (cleanup: () => void) => void,
    ) => {
      onCleanup(() => {
        onWatchCleanedRef.current?.(value);
      });
    },
  );
  useEffect(() => {
    const previous = previousQuery.current;
    previousQuery.current = query;
    const cleanups: (() => void)[] = [];
    onQueryChange(query, previous, (cleanup) => void cleanups.push(cleanup));
    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, [query]);

  const previousQuery_1 = useRef(query);
  const onQueryChange_1 = useEffectEvent((value: typeof query) => {
    resultsRef.current = value === "" ? [] : [value, `${value} docs`];
    setResults(resultsRef.current);
  });
  useEffect(() => {
    const previous = previousQuery_1.current;
    if (Object.is(previous, query)) return;
    previousQuery_1.current = query;
    onQueryChange_1(query);
  }, [query]);

  const [waits, setWaits] = useState(0);
  const previousQuery_2 = useRef<[typeof query] | undefined>(undefined);
  const queryCleanups = useRef<(() => void)[]>([]);
  const onQueryChange_2 = useEffectEvent(
    (queryValue: typeof query, onCleanup: (cleanup: () => void) => void) => {
      const value = queryValue;
      onCleanup(() => {
        onEffectCleanedRef.current?.(value);
      });
    },
  );
  useEffect(() => {
    if (!Object.is(resultsRef.current, results)) {
      setWaits(waits + 1);
      return;
    }
    const previous = previousQuery_2.current;
    if (previous && Object.is(previous[0], query)) return;
    previousQuery_2.current = [query];
    for (const cleanup of queryCleanups.current.splice(0)) cleanup();
    onQueryChange_2(query, (cleanup) => void queryCleanups.current.push(cleanup));
  }, [query, results, waits]);
  useEffect(
    () => () => {
      previousQuery_2.current = undefined;
      for (const cleanup of queryCleanups.current.splice(0)) cleanup();
    },
    [],
  );

  const previousQuery_3 = useRef(query);
  const queryCleanups_1 = useRef<(() => void)[]>([]);
  const onQueryChange_3 = useEffectEvent(
    (value: typeof query, previous: typeof query, onCleanup: (cleanup: () => void) => void) => {
      onSearched?.(value, resultsRef.current.length);
      onCleanup(() => {
        onSearchCleanedRef.current?.(value);
      });
    },
  );
  useEffect(() => {
    if (!Object.is(resultsRef.current, results)) {
      setWaits(waits + 1);
      return;
    }
    const previous = previousQuery_3.current;
    if (Object.is(previous, query)) return;
    previousQuery_3.current = query;
    for (const cleanup of queryCleanups_1.current.splice(0)) cleanup();
    onQueryChange_3(query, previous, (cleanup) => void queryCleanups_1.current.push(cleanup));
  }, [query, results, waits]);
  useEffect(
    () => () => {
      for (const cleanup of queryCleanups_1.current.splice(0)) cleanup();
    },
    [],
  );

  const previousResultsQuery = useRef<[typeof results, typeof query] | undefined>(undefined);
  const onResultsQueryChange = useEffectEvent(
    (resultsValue: typeof results, queryValue_1: typeof query) => {
      onSummary?.(`${resultsValue.length} results for "${queryValue_1}"`);
    },
  );
  useEffect(() => {
    if (!Object.is(resultsRef.current, results)) {
      setWaits(waits + 1);
      return;
    }
    const previous = previousResultsQuery.current;
    if (previous && Object.is(previous[0], results) && Object.is(previous[1], query)) return;
    previousResultsQuery.current = [results, query];
    onResultsQueryChange(results, query);
  }, [results, query, waits]);

  const onUnmount = useEffectEvent(() => {
    onUnmounted?.();
  });
  useEffect(() => () => onUnmount(), []);

  return (
    <section className="search-session" aria-label="Search">
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
      <ul aria-label="Results">
        {results.map((result) => (
          <li key={result}>{result}</li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          resultsRef.current = [];
          setResults(resultsRef.current);
        }}
      >
        Clear results
      </button>
    </section>
  );
}
