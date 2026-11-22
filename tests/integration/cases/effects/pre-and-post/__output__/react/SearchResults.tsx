import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { useNextTick } from "./_unframework/useNextTick";
import {
  type CSSProperties,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

export interface SearchResultsEvents {
  onReady?: (text: string) => void;
  onRendered?: (count: number) => void;
  onShown?: (text: string) => void;
}

export interface SearchResultsAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function SearchResults({
  onReady,
  onRendered,
  onShown,
  className,
  style,
  ...attributes
}: SearchResultsEvents & SearchResultsAttributes) {
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
    <section
      className={cx("search-results", className)}
      aria-label="Search"
      style={style}
      {...scopeAttributes(attributes)}
    >
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
