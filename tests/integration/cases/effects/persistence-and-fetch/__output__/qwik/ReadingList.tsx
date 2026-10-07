import {
  $,
  type QRL,
  component$,
  noSerialize,
  useConstant,
  useSignal,
  useTask$,
  useVisibleTask$,
} from "@qwik.dev/core";

export interface ReadingListProps {
  shelves: string[];
}

export interface ReadingListEvents {
  onRequested$?: QRL<(url: string) => void>;
  onCancelled$?: QRL<(query: string) => void>;
  onFound$?: QRL<(query: string, count: number) => void>;
  onStarted$?: QRL<() => void>;
  onChecked$?: QRL<(count: number) => void>;
  onRefreshed$?: QRL<(total: number) => void>;
}

export default component$<ReadingListProps & ReadingListEvents>(
  ({ shelves, onRequested$, onCancelled$, onFound$, onStarted$, onChecked$, onRefreshed$ }) => {
    const query = useSignal("");
    const books = useSignal<string[]>([]);
    const searching = useSignal(false);
    const failure = useSignal("");
    const shelf = useSignal("all");
    const checking = useSignal(false);
    const checks = useSignal(0);
    const counts = useSignal<Record<string, number>>({});
    const refreshing = useSignal(false);
    const checker = useSignal<ReturnType<typeof setInterval> | undefined>();

    const previousShelf = useSignal(() => shelf.value);
    useTask$(
      ({ track }) => {
        const value = track(shelf);
        if (Object.is(value, previousShelf.value)) return;
        previousShelf.value = value;
        localStorage.setItem("reading-list:shelf", value);
      },
      { deferUpdates: false },
    );

    const previousQuery = useSignal(() => query.value);
    const queryCleanups = useConstant(() => noSerialize<(() => void)[]>([]));
    useTask$(
      ({ track }) => {
        const value = track(query);
        if (Object.is(value, previousQuery.value)) return;
        previousQuery.value = value;
        for (const callback of queryCleanups?.splice(0) ?? []) callback();
        const onCleanup = (callback: () => void) => void queryCleanups?.push(callback);
        void (async () => {
          const controller = new AbortController();
          onCleanup(() => controller.abort());
          if (value === "") {
            books.value = [];
            searching.value = false;
            return;
          }
          const url = `/api/books?${new URLSearchParams({ q: value, shelf: shelf.value })}`;
          searching.value = true;
          failure.value = "";
          onRequested$?.(url);
          try {
            const response = await fetch(url, { signal: controller.signal });
            const found = (await response.json()) as string[];
            books.value = found;
            searching.value = false;
            onFound$?.(value, found.length);
          } catch (error) {
            if (controller.signal.aborted) {
              onCancelled$?.(value);
              return;
            }
            searching.value = false;
            failure.value = error instanceof Error ? error.message : "The search failed";
          }
        })();
      },
      { deferUpdates: false },
    );
    useVisibleTask$(
      ({ cleanup }) => {
        cleanup(() => {
          for (const callback of queryCleanups?.splice(0) ?? []) callback();
        });
      },
      { strategy: "document-ready" },
    );

    const previousEffect = useSignal<[typeof checking.value]>();
    const effectCleanups = useConstant(() => noSerialize<(() => void)[]>([]));
    useVisibleTask$(
      ({ track }) => {
        const values: [typeof checking.value] = [track(checking)];
        const last = previousEffect.value;
        if (last && values.every((item, index) => Object.is(item, last[index]))) return;
        previousEffect.value = values;
        for (const callback of effectCleanups?.splice(0) ?? []) callback();
        const onCleanup = (callback: () => void) => void effectCleanups?.push(callback);
        if (!checking.value) return;
        const check = () => {
          checks.value += 1;
          onChecked$?.(checks.value);
        };
        checker.value = setInterval(check, 1000);
        onStarted$?.();
        onCleanup(() => clearInterval(checker.value));
      },
      { strategy: "document-ready" },
    );
    useVisibleTask$(
      ({ cleanup }) => {
        cleanup(() => {
          for (const callback of effectCleanups?.splice(0) ?? []) callback();
        });
      },
      { strategy: "document-ready" },
    );

    const countShelf = $(async (name: string) => {
      const response = await fetch(`/api/shelves?${new URLSearchParams({ name })}`);
      const list = (await response.json()) as string[];
      counts.value = { ...counts.value, [name]: list.length };
    });

    const refreshAll = $(async () => {
      refreshing.value = true;
      await Promise.all(shelves.map(countShelf));
      refreshing.value = false;
      onRefreshed$?.(shelves.reduce((total, name) => total + (counts.value[name] ?? 0), 0));
    });

    return (
      <section class="reading-list" aria-label="Reading list">
        <label>
          Search
          <input
            type="search"
            name="query"
            onInput$={(_, element) => (query.value = (element as HTMLInputElement).value)}
          />
        </label>
        <p role="status">
          {searching.value ? "Searching" : `${books.value.length} found`}
          {failure.value === "" ? "" : `: ${failure.value}`}
        </p>
        <ul aria-label="Books">
          {books.value.map((book) => (
            <li key={book}>{book}</li>
          ))}
        </ul>
        <div role="group" aria-label="Shelf">
          <button
            type="button"
            aria-pressed={shelf.value === "all"}
            onClick$={() => (shelf.value = "all")}
          >
            All
          </button>
          <button
            type="button"
            aria-pressed={shelf.value === "unread"}
            onClick$={() => (shelf.value = "unread")}
          >
            Unread
          </button>
        </div>
        <button
          type="button"
          aria-pressed={checking.value}
          onClick$={() => (checking.value = !checking.value)}
        >
          Check for new books
        </button>
        <p>Checks: {checks.value}</p>
        <button type="button" onClick$={refreshAll}>
          Refresh shelves
        </button>
        <ul aria-label="Shelves">
          {shelves.map((name) => (
            <li key={name}>
              {name}: {counts.value[name] ?? "not counted"}
            </li>
          ))}
        </ul>
        <p>{refreshing.value ? "Refreshing" : "Up to date"}</p>
      </section>
    );
  },
);
