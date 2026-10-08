import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";

export interface ReadingListProps {
  shelves: string[];
}

export interface ReadingListEvents {
  onRequested?: (url: string) => void;
  onCancelled?: (query: string) => void;
  onFound?: (query: string, count: number) => void;
  onStarted?: () => void;
  onChecked?: (count: number) => void;
  onRefreshed?: (total: number) => void;
}

export default function ReadingList({
  shelves,
  onRequested,
  onCancelled,
  onFound,
  onStarted,
  onChecked,
  onRefreshed,
}: ReadingListProps & ReadingListEvents) {
  // React Compiler 1.0 cannot compile `?.` inside a `try` block yet: the component opts out of it.
  "use no memo";

  const shelvesRef = useRef(shelves);
  const onCancelledRef = useRef(onCancelled);
  const onFoundRef = useRef(onFound);
  const onCheckedRef = useRef(onChecked);
  const onRefreshedRef = useRef(onRefreshed);
  useLayoutEffect(() => {
    shelvesRef.current = shelves;
    onCancelledRef.current = onCancelled;
    onFoundRef.current = onFound;
    onCheckedRef.current = onChecked;
    onRefreshedRef.current = onRefreshed;
  });

  const [query, setQuery] = useState("");
  const queryRef = useRef(query);
  const [books, setBooks] = useState<string[]>([]);
  const booksRef = useRef(books);
  const [searching, setSearching] = useState(false);
  const searchingRef = useRef(searching);
  const [failure, setFailure] = useState("");
  const failureRef = useRef(failure);
  const [shelf, setShelf] = useState("all");
  const shelfRef = useRef(shelf);
  const [checking, setChecking] = useState(false);
  const checkingRef = useRef(checking);
  const [checks, setChecks] = useState(0);
  const checksRef = useRef(checks);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const countsRef = useRef(counts);
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(refreshing);
  const checker = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const previousShelf = useRef(shelf);
  const onShelfChange = useEffectEvent((value: typeof shelf) => {
    localStorage.setItem("reading-list:shelf", value);
  });
  useEffect(() => {
    const previous = previousShelf.current;
    if (Object.is(previous, shelf)) return;
    previousShelf.current = shelf;
    onShelfChange(shelf);
  }, [shelf]);

  const previousQuery = useRef(query);
  const onQueryChange = useEffectEvent(
    async (
      value: typeof query,
      previous: typeof query,
      onCleanup: (cleanup: () => void) => void,
    ) => {
      const controller = new AbortController();
      onCleanup(() => controller.abort());
      if (value === "") {
        booksRef.current = [];
        setBooks(booksRef.current);
        searchingRef.current = false;
        setSearching(searchingRef.current);
        return;
      }
      const url = `/api/books?${new URLSearchParams({ q: value, shelf: shelfRef.current })}`;
      searchingRef.current = true;
      setSearching(searchingRef.current);
      failureRef.current = "";
      setFailure(failureRef.current);
      onRequested?.(url);
      try {
        const response = await fetch(url, { signal: controller.signal });
        const found = (await response.json()) as string[];
        booksRef.current = found;
        setBooks(booksRef.current);
        searchingRef.current = false;
        setSearching(searchingRef.current);
        onFoundRef.current?.(value, found.length);
      } catch (error) {
        if (controller.signal.aborted) {
          onCancelledRef.current?.(value);
          return;
        }
        searchingRef.current = false;
        setSearching(searchingRef.current);
        failureRef.current = error instanceof Error ? error.message : "The search failed";
        setFailure(failureRef.current);
      }
    },
  );
  useEffect(() => {
    const previous = previousQuery.current;
    if (Object.is(previous, query)) return;
    previousQuery.current = query;
    const cleanups: (() => void)[] = [];
    onQueryChange(query, previous, (cleanup) => void cleanups.push(cleanup));
    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, [query]);

  const [waits, setWaits] = useState(0);
  const previousChecking = useRef<[typeof checking] | undefined>(undefined);
  const checkingCleanups = useRef<(() => void)[]>([]);
  const onCheckingChange = useEffectEvent(
    (checkingValue: typeof checking, onCleanup: (cleanup: () => void) => void) => {
      if (!checkingValue) return;
      const check = () => {
        checksRef.current += 1;
        setChecks(checksRef.current);
        onCheckedRef.current?.(checksRef.current);
      };
      checker.current = setInterval(check, 1000);
      onStarted?.();
      onCleanup(() => clearInterval(checker.current));
    },
  );
  useEffect(() => {
    if (
      !Object.is(booksRef.current, books) ||
      !Object.is(searchingRef.current, searching) ||
      !Object.is(failureRef.current, failure)
    ) {
      setWaits(waits + 1);
      return;
    }
    const previous = previousChecking.current;
    if (previous && Object.is(previous[0], checking)) return;
    previousChecking.current = [checking];
    for (const cleanup of checkingCleanups.current.splice(0)) cleanup();
    onCheckingChange(checking, (cleanup) => void checkingCleanups.current.push(cleanup));
  }, [checking, books, searching, failure, waits]);
  useEffect(
    () => () => {
      previousChecking.current = undefined;
      for (const cleanup of checkingCleanups.current.splice(0)) cleanup();
    },
    [],
  );

  const [countShelf] = useState(() => async (name: string) => {
    const response = await fetch(`/api/shelves?${new URLSearchParams({ name })}`);
    const list = (await response.json()) as string[];
    countsRef.current = { ...countsRef.current, [name]: list.length };
    setCounts(countsRef.current);
  });

  async function refreshAll() {
    refreshingRef.current = true;
    setRefreshing(refreshingRef.current);
    await Promise.all(shelvesRef.current.map(countShelf));
    refreshingRef.current = false;
    setRefreshing(refreshingRef.current);
    onRefreshedRef.current?.(
      shelvesRef.current.reduce((total, name) => total + (countsRef.current[name] ?? 0), 0),
    );
  }

  return (
    <section className="reading-list" aria-label="Reading list">
      <label>
        Search
        <input
          type="search"
          name="query"
          onInput={(event) => {
            queryRef.current = (event.currentTarget as HTMLInputElement).value;
            setQuery(queryRef.current);
          }}
        />
      </label>
      <p role="status">
        {searching ? "Searching" : `${books.length} found`}
        {failure === "" ? "" : `: ${failure}`}
      </p>
      <ul aria-label="Books">
        {books.map((book) => (
          <li key={book}>{book}</li>
        ))}
      </ul>
      <div role="group" aria-label="Shelf">
        <button
          type="button"
          aria-pressed={shelf === "all"}
          onClick={() => {
            shelfRef.current = "all";
            setShelf(shelfRef.current);
          }}
        >
          All
        </button>
        <button
          type="button"
          aria-pressed={shelf === "unread"}
          onClick={() => {
            shelfRef.current = "unread";
            setShelf(shelfRef.current);
          }}
        >
          Unread
        </button>
      </div>
      <button
        type="button"
        aria-pressed={checking}
        onClick={() => {
          checkingRef.current = !checkingRef.current;
          setChecking(checkingRef.current);
        }}
      >
        Check for new books
      </button>
      <p>Checks: {checks}</p>
      <button type="button" onClick={refreshAll}>
        Refresh shelves
      </button>
      <ul aria-label="Shelves">
        {shelves.map((name) => (
          <li key={name}>
            {name}: {counts[name] ?? "not counted"}
          </li>
        ))}
      </ul>
      <p>{refreshing ? "Refreshing" : "Up to date"}</p>
    </section>
  );
}
