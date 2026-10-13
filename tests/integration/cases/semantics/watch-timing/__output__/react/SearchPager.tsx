import {
  type CSSProperties,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

export interface SearchPagerEvents {
  onQueryRun?: (value: string, previous: string) => void;
  onPageRun?: (value: number, previous: number) => void;
  onCleanedUp?: (watcher: string) => void;
}

export interface SearchPagerAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function SearchPager({
  onQueryRun,
  onPageRun,
  onCleanedUp,
  className,
  style,
}: SearchPagerEvents & SearchPagerAttributes) {
  const onCleanedUpRef = useRef(onCleanedUp);
  useLayoutEffect(() => {
    onCleanedUpRef.current = onCleanedUp;
  });

  const [query, setQuery] = useState("");
  const queryRef = useRef(query);
  const [page, setPage] = useState(1);
  const pageRef = useRef(page);

  const previousQuery = useRef(query);
  const onQueryChange = useEffectEvent(
    (value: typeof query, previous: typeof query, onCleanup: (cleanup: () => void) => void) => {
      onQueryRun?.(value, previous);
      onCleanup(() => {
        onCleanedUpRef.current?.("query");
      });
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

  const previousPage = useRef(page);
  const onPageChange = useEffectEvent((value: typeof page, previous: typeof page) => {
    onPageRun?.(value, previous);
  });
  useEffect(() => {
    const previous = previousPage.current;
    if (Object.is(previous, page)) return;
    previousPage.current = page;
    onPageChange(page, previous);
  }, [page]);

  function search(term: string) {
    queryRef.current = term;
    setQuery(queryRef.current);
    queryRef.current = queryRef.current.toLowerCase();
    setQuery(queryRef.current);
    pageRef.current = 1;
    setPage(pageRef.current);
  }

  function nextPage() {
    pageRef.current += 1;
    setPage(pageRef.current);
  }

  function skipTwoPages() {
    pageRef.current += 1;
    setPage(pageRef.current);
    pageRef.current += 1;
    setPage(pageRef.current);
  }

  return (
    <section className={cx("search-pager", className)} aria-label="Search" style={style}>
      <p role="status">
        {query === "" ? "All results" : `Results for ${query}`}, page {page}
      </p>
      <button type="button" onClick={() => search("Boots")}>
        Search boots
      </button>
      <button type="button" onClick={() => search("Sandals")}>
        Search sandals
      </button>
      <button type="button" onClick={nextPage}>
        Next page
      </button>
      <button type="button" onClick={skipTwoPages}>
        Skip two pages
      </button>
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
